import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FollowUpReportReceived } from '../../common/events';
import { RelojSimulado } from '../../common/reloj/reloj-simulado';
import { EstadoSeguimiento, OrigenEvidencia, TipoSeguimiento } from './entities/seguimiento.enum';
import { ReporteService } from './reporte.service';

const MANAGER = { id: 'manager' } as never;
const FILA = {
  id: 5,
  adopcionId: 9,
  mascotaId: 4,
  fundacionId: 3,
  tipo: TipoSeguimiento.Reporte,
  estado: EstadoSeguimiento.Programado,
  fechaEntrega: '2026-11-01',
  reporteEnviadoEn: null as Date | null,
};
const DETALLE = { id: 5 };
const foto = (n: number) => Buffer.from([0xff, 0xd8, 0xff, n]);

describe('ReporteService.enviar', () => {
  const orden: string[] = [];
  const repo = {
    enTransaccion: jest.fn(),
    buscarParaAccion: jest.fn(),
    bloquearParaAccion: jest.fn(),
    guardarReporte: jest.fn(),
    borrarEvidencias: jest.fn(),
    insertarEvidencias: jest.fn(),
    obtenerDeAdoptante: jest.fn(),
  };
  const usuarios = { adoptantePorUsuarioId: jest.fn() };
  const storage = {
    guardar: jest.fn(),
    eliminar: jest.fn(),
    leer: jest.fn(),
    urlPublica: jest.fn(),
  };
  const eventos = { emit: jest.fn() };
  const reloj = new RelojSimulado(new Date('2026-11-10T08:00:00Z'));
  const service = new ReporteService(
    repo as never,
    usuarios as never,
    storage as never,
    eventos as never,
    reloj,
  );
  let contador = 0;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    orden.length = 0;
    contador = 0;
    usuarios.adoptantePorUsuarioId.mockResolvedValue({ id: 8 });
    repo.buscarParaAccion.mockResolvedValue(FILA);
    repo.bloquearParaAccion.mockResolvedValue(FILA);
    repo.guardarReporte.mockResolvedValue(true);
    repo.borrarEvidencias.mockResolvedValue([]);
    repo.insertarEvidencias.mockResolvedValue(undefined);
    repo.obtenerDeAdoptante.mockResolvedValue(DETALLE);
    storage.guardar.mockImplementation(() => {
      contador += 1;
      orden.push(`GUARDAR${contador}`);
      return Promise.resolve({ clave: `privado/seguimientos/nueva-${contador}.jpg` });
    });
    storage.eliminar.mockImplementation((clave: string) => {
      orden.push(`ELIMINAR ${clave}`);
      return Promise.resolve();
    });
    repo.enTransaccion.mockImplementation(async (trabajo: (m: unknown) => Promise<unknown>) => {
      orden.push('BEGIN');
      const r = await trabajo(MANAGER);
      orden.push('COMMIT');
      return r;
    });
    eventos.emit.mockImplementation(() => orden.push('EMIT'));
  });

  it('precomprueba, guarda en privado/seguimientos, reemplaza bajo bloqueo y emite tras el commit', async () => {
    const resultado = await service.enviar(21, 5, 'Come bien', [foto(1), foto(2)]);
    expect(resultado).toBe(DETALLE);
    expect(repo.buscarParaAccion).toHaveBeenCalledWith(5, { tipo: 'adoptante', adoptanteId: 8 });
    expect(repo.bloquearParaAccion).toHaveBeenCalledWith(MANAGER, 5, {
      tipo: 'adoptante',
      adoptanteId: 8,
    });
    expect(storage.guardar).toHaveBeenCalledWith(
      { buffer: foto(1) },
      { categoria: 'imagen', carpeta: 'seguimientos' },
    );
    expect(repo.guardarReporte).toHaveBeenCalledWith(MANAGER, 5, 'Come bien');
    expect(repo.insertarEvidencias).toHaveBeenCalledWith(
      MANAGER,
      5,
      ['privado/seguimientos/nueva-1.jpg', 'privado/seguimientos/nueva-2.jpg'],
      OrigenEvidencia.Adoptante,
    );
    expect(orden).toEqual(['GUARDAR1', 'GUARDAR2', 'BEGIN', 'COMMIT', 'EMIT']);
    const [nombre, evento] = eventos.emit.mock.calls[0] as [string, FollowUpReportReceived];
    expect(nombre).toBe(FollowUpReportReceived.eventName);
    expect(evento).toEqual(new FollowUpReportReceived(5, 9));
  });

  it('un reporte sin fotos es válido y no escribe archivos', async () => {
    await service.enviar(21, 5, 'Todo bien', []);
    expect(storage.guardar).not.toHaveBeenCalled();
    expect(repo.insertarEvidencias).toHaveBeenCalledWith(MANAGER, 5, [], OrigenEvidencia.Adoptante);
    expect(eventos.emit).toHaveBeenCalledTimes(1);
  });

  it('el reenvío reemplaza, borra del disco las fotos viejas solo tras el commit y NO vuelve a emitir', async () => {
    repo.bloquearParaAccion.mockResolvedValue({ ...FILA, reporteEnviadoEn: new Date() });
    repo.borrarEvidencias.mockResolvedValue([
      'privado/seguimientos/vieja-1.jpg',
      'privado/seguimientos/vieja-2.jpg',
    ]);
    await service.enviar(21, 5, 'Corrijo', [foto(1)]);
    expect(orden).toEqual([
      'GUARDAR1',
      'BEGIN',
      'COMMIT',
      'ELIMINAR privado/seguimientos/vieja-1.jpg',
      'ELIMINAR privado/seguimientos/vieja-2.jpg',
    ]);
    expect(eventos.emit).not.toHaveBeenCalled();
  });

  it('un seguimiento ajeno o inexistente es 404 y no escribe nada', async () => {
    repo.buscarParaAccion.mockResolvedValue(null);
    await expect(service.enviar(21, 5, 'x', [foto(1)])).rejects.toThrow(
      new NotFoundException('El seguimiento no existe'),
    );
    expect(storage.guardar).not.toHaveBeenCalled();
    expect(repo.enTransaccion).not.toHaveBeenCalled();
  });

  it('una visita no admite reporte: 409 sin guardar archivos', async () => {
    repo.buscarParaAccion.mockResolvedValue({ ...FILA, tipo: TipoSeguimiento.Visita });
    await expect(service.enviar(21, 5, 'x', [foto(1)])).rejects.toThrow(
      new ConflictException('Este seguimiento es una visita y no admite reporte'),
    );
    expect(storage.guardar).not.toHaveBeenCalled();
  });

  it.each([EstadoSeguimiento.Realizado, EstadoSeguimiento.Cancelado])(
    'un seguimiento %s es 409 sin guardar archivos',
    async (estado) => {
      repo.buscarParaAccion.mockResolvedValue({ ...FILA, estado });
      await expect(service.enviar(21, 5, 'x', [foto(1)])).rejects.toThrow(
        new ConflictException(`El seguimiento ya está ${estado}`),
      );
      expect(storage.guardar).not.toHaveBeenCalled();
    },
  );

  it.each([EstadoSeguimiento.Programado, EstadoSeguimiento.Vencido])(
    'un seguimiento %s admite reporte',
    async (estado) => {
      repo.buscarParaAccion.mockResolvedValue({ ...FILA, estado });
      repo.bloquearParaAccion.mockResolvedValue({ ...FILA, estado });
      await expect(service.enviar(21, 5, 'x', [])).resolves.toBe(DETALLE);
    },
  );

  it('si bajo bloqueo ya está realizado (carrera con el cierre): 409 y borra las fotos nuevas', async () => {
    repo.bloquearParaAccion.mockResolvedValue({ ...FILA, estado: EstadoSeguimiento.Realizado });
    await expect(service.enviar(21, 5, 'x', [foto(1), foto(2)])).rejects.toThrow(ConflictException);
    expect(repo.guardarReporte).not.toHaveBeenCalled();
    expect(orden).toContain('ELIMINAR privado/seguimientos/nueva-1.jpg');
    expect(orden).toContain('ELIMINAR privado/seguimientos/nueva-2.jpg');
    expect(eventos.emit).not.toHaveBeenCalled();
  });

  it('si el UPDATE condicionado no afecta filas: 409, rollback, fotos nuevas borradas y sin evento', async () => {
    repo.guardarReporte.mockResolvedValue(false);
    await expect(service.enviar(21, 5, 'x', [foto(1)])).rejects.toThrow(ConflictException);
    expect(repo.insertarEvidencias).not.toHaveBeenCalled();
    expect(orden).not.toContain('COMMIT');
    expect(orden).toContain('ELIMINAR privado/seguimientos/nueva-1.jpg');
    expect(eventos.emit).not.toHaveBeenCalled();
  });

  it('si falla el INSERT de las fotos: borra las nuevas, conserva las viejas y propaga el error original', async () => {
    repo.borrarEvidencias.mockResolvedValue(['privado/seguimientos/vieja.jpg']);
    repo.insertarEvidencias.mockRejectedValue(new Error('fallo de la base'));
    await expect(service.enviar(21, 5, 'x', [foto(1)])).rejects.toThrow('fallo de la base');
    expect(orden).toContain('ELIMINAR privado/seguimientos/nueva-1.jpg');
    expect(orden).not.toContain('ELIMINAR privado/seguimientos/vieja.jpg');
    expect(eventos.emit).not.toHaveBeenCalled();
  });

  it('si falla el guardado de la tercera foto: borra las dos ya guardadas y no abre transacción', async () => {
    storage.guardar
      .mockResolvedValueOnce({ clave: 'privado/seguimientos/a.jpg' })
      .mockResolvedValueOnce({ clave: 'privado/seguimientos/b.jpg' })
      .mockRejectedValueOnce(new BadRequestException('Solo se permiten imágenes JPG o PNG'));
    await expect(service.enviar(21, 5, 'x', [foto(1), foto(2), foto(3)])).rejects.toThrow(
      'Solo se permiten imágenes JPG o PNG',
    );
    expect(storage.eliminar).toHaveBeenCalledWith('privado/seguimientos/a.jpg');
    expect(storage.eliminar).toHaveBeenCalledWith('privado/seguimientos/b.jpg');
    expect(repo.enTransaccion).not.toHaveBeenCalled();
  });

  it('un fallo al borrar un archivo se registra y no oculta el error original ni el éxito', async () => {
    storage.eliminar.mockRejectedValue(new Error('disco'));
    repo.guardarReporte.mockResolvedValue(false);
    await expect(service.enviar(21, 5, 'x', [foto(1)])).rejects.toThrow(ConflictException);
    expect(Logger.prototype.warn).toHaveBeenCalled();

    repo.guardarReporte.mockResolvedValue(true);
    repo.borrarEvidencias.mockResolvedValue(['privado/seguimientos/vieja.jpg']);
    await expect(service.enviar(21, 5, 'x', [])).resolves.toBe(DETALLE);
  });

  it('más de 5 fotos es 400 antes de tocar nada', async () => {
    await expect(
      service.enviar(21, 5, 'x', [foto(1), foto(2), foto(3), foto(4), foto(5), foto(6)]),
    ).rejects.toThrow(new BadRequestException('No puedes adjuntar más de 5 fotos'));
    expect(usuarios.adoptantePorUsuarioId).not.toHaveBeenCalled();
    expect(storage.guardar).not.toHaveBeenCalled();
  });

  it('un usuario sin perfil de adoptante recibe 403', async () => {
    usuarios.adoptantePorUsuarioId.mockResolvedValue(null);
    await expect(service.enviar(21, 5, 'x', [])).rejects.toThrow(ForbiddenException);
  });

  it('un listener que lanza no rompe la respuesta', async () => {
    eventos.emit.mockImplementation(() => {
      throw new Error('listener roto');
    });
    await expect(service.enviar(21, 5, 'x', [])).resolves.toBe(DETALLE);
  });
});
