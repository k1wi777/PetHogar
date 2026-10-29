import { BadRequestException, ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { WellbeingAlertRaised } from '../../common/events';
import { RelojSimulado } from '../../common/reloj/reloj-simulado';
import type { RegistrarResultadoDto } from './dto/registrar-resultado.dto';
import {
  EstadoBienestar,
  EstadoSeguimiento,
  OrigenEvidencia,
  TipoSeguimiento,
} from './entities/seguimiento.enum';
import { ResultadoService } from './resultado.service';

const MANAGER = { id: 'manager' } as never;
const FILA = {
  id: 5,
  adopcionId: 9,
  mascotaId: 4,
  fundacionId: 3,
  tipo: TipoSeguimiento.Visita,
  estado: EstadoSeguimiento.Programado,
  fechaEntrega: '2026-11-01',
  reporteEnviadoEn: null as Date | null,
};
const DETALLE = { id: 5 };
const dto = (extra: Partial<RegistrarResultadoDto> = {}): RegistrarResultadoDto =>
  ({
    fechaRealizada: '2026-11-09',
    estadoBienestar: EstadoBienestar.Bueno,
    observaciones: 'Todo en orden',
    ...extra,
  }) as RegistrarResultadoDto;
const foto = (n: number) => Buffer.from([0xff, 0xd8, 0xff, n]);

describe('ResultadoService.registrar', () => {
  const orden: string[] = [];
  const repo = {
    enTransaccion: jest.fn(),
    buscarParaAccion: jest.fn(),
    bloquearParaAccion: jest.fn(),
    registrarResultado: jest.fn(),
    insertarEvidencias: jest.fn(),
    obtenerDeFundacion: jest.fn(),
  };
  const storage = {
    guardar: jest.fn(),
    eliminar: jest.fn(),
    leer: jest.fn(),
    urlPublica: jest.fn(),
  };
  const eventos = { emit: jest.fn() };
  // Hoy en Bogotá: 2026-11-10.
  const reloj = new RelojSimulado(new Date('2026-11-10T08:00:00Z'));
  const service = new ResultadoService(repo as never, storage as never, eventos as never, reloj);
  let contador = 0;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    reloj.fijar('2026-11-10T08:00:00Z');
    orden.length = 0;
    contador = 0;
    repo.buscarParaAccion.mockResolvedValue(FILA);
    repo.bloquearParaAccion.mockResolvedValue(FILA);
    repo.registrarResultado.mockResolvedValue(true);
    repo.insertarEvidencias.mockResolvedValue(undefined);
    repo.obtenerDeFundacion.mockResolvedValue(DETALLE);
    storage.guardar.mockImplementation(() => {
      contador += 1;
      orden.push(`GUARDAR${contador}`);
      return Promise.resolve({ clave: `privado/seguimientos/ev-${contador}.jpg` });
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

  it('cierra bajo bloqueo, guarda evidencias con origen fundación y devuelve el detalle', async () => {
    const resultado = await service.registrar(5, 3, dto(), [foto(1), foto(2)]);
    expect(resultado).toBe(DETALLE);
    expect(repo.buscarParaAccion).toHaveBeenCalledWith(5, { tipo: 'fundacion', fundacionId: 3 });
    expect(repo.bloquearParaAccion).toHaveBeenCalledWith(MANAGER, 5, {
      tipo: 'fundacion',
      fundacionId: 3,
    });
    expect(repo.registrarResultado).toHaveBeenCalledWith(MANAGER, 5, {
      fechaRealizada: '2026-11-09',
      estadoBienestar: 'bueno',
      observaciones: 'Todo en orden',
    });
    expect(repo.insertarEvidencias).toHaveBeenCalledWith(
      MANAGER,
      5,
      ['privado/seguimientos/ev-1.jpg', 'privado/seguimientos/ev-2.jpg'],
      OrigenEvidencia.Fundacion,
    );
    expect(storage.guardar).toHaveBeenCalledWith(
      { buffer: foto(1) },
      { categoria: 'imagen', carpeta: 'seguimientos' },
    );
    expect(orden).toEqual(['GUARDAR1', 'GUARDAR2', 'BEGIN', 'COMMIT']);
  });

  it('con bienestar malo emite WellbeingAlertRaised tras el commit con los ids del seguimiento', async () => {
    await service.registrar(5, 3, dto({ estadoBienestar: EstadoBienestar.Malo }), []);
    expect(orden).toEqual(['BEGIN', 'COMMIT', 'EMIT']);
    const [nombre, evento] = eventos.emit.mock.calls[0] as [string, WellbeingAlertRaised];
    expect(nombre).toBe(WellbeingAlertRaised.eventName);
    expect(evento).toEqual(new WellbeingAlertRaised(5, 9, 4, 3));
  });

  it.each([EstadoBienestar.Bueno, EstadoBienestar.Regular])(
    'con bienestar %s NO emite alerta',
    async (estadoBienestar) => {
      await service.registrar(5, 3, dto({ estadoBienestar }), []);
      expect(eventos.emit).not.toHaveBeenCalled();
    },
  );

  it('ajeno o inexistente: 404 sin tocar archivos', async () => {
    repo.buscarParaAccion.mockResolvedValue(null);
    await expect(service.registrar(5, 3, dto(), [foto(1)])).rejects.toThrow(
      new NotFoundException('El seguimiento no existe'),
    );
    expect(storage.guardar).not.toHaveBeenCalled();
  });

  it('ya realizado: 409 con mensaje claro, sin archivos, y no emite aunque sea malo', async () => {
    repo.buscarParaAccion.mockResolvedValue({ ...FILA, estado: EstadoSeguimiento.Realizado });
    await expect(
      service.registrar(5, 3, dto({ estadoBienestar: EstadoBienestar.Malo }), [foto(1)]),
    ).rejects.toThrow(new ConflictException('El seguimiento ya fue registrado como realizado'));
    expect(storage.guardar).not.toHaveBeenCalled();
    expect(eventos.emit).not.toHaveBeenCalled();
  });

  it('cancelado: 409', async () => {
    repo.buscarParaAccion.mockResolvedValue({ ...FILA, estado: EstadoSeguimiento.Cancelado });
    await expect(service.registrar(5, 3, dto(), [])).rejects.toThrow(
      new ConflictException('El seguimiento está cancelado'),
    );
  });

  it('un seguimiento vencido todavía se puede cerrar', async () => {
    repo.buscarParaAccion.mockResolvedValue({ ...FILA, estado: EstadoSeguimiento.Vencido });
    repo.bloquearParaAccion.mockResolvedValue({ ...FILA, estado: EstadoSeguimiento.Vencido });
    await expect(service.registrar(5, 3, dto(), [])).resolves.toBe(DETALLE);
  });

  it('un reporte sin el reporte del adoptante: 409; una visita sin reporte se cierra', async () => {
    repo.buscarParaAccion.mockResolvedValue({ ...FILA, tipo: TipoSeguimiento.Reporte });
    await expect(service.registrar(5, 3, dto(), [foto(1)])).rejects.toThrow(
      new ConflictException('El adoptante todavía no ha enviado el reporte'),
    );
    expect(storage.guardar).not.toHaveBeenCalled();

    const conReporte = { ...FILA, tipo: TipoSeguimiento.Reporte, reporteEnviadoEn: new Date() };
    repo.buscarParaAccion.mockResolvedValue(conReporte);
    repo.bloquearParaAccion.mockResolvedValue(conReporte);
    await expect(service.registrar(5, 3, dto(), [])).resolves.toBe(DETALLE);
    // La visita (FILA) ya se cerró sin reporte en las demás pruebas.
  });

  it('fecha futura: 400 sin archivos; hoy es válido', async () => {
    await expect(
      service.registrar(5, 3, dto({ fechaRealizada: '2026-11-11' }), [foto(1)]),
    ).rejects.toThrow(new BadRequestException('La fecha realizada no puede ser futura'));
    expect(storage.guardar).not.toHaveBeenCalled();
    expect(repo.enTransaccion).not.toHaveBeenCalled();
    await expect(service.registrar(5, 3, dto({ fechaRealizada: '2026-11-10' }), [])).resolves.toBe(
      DETALLE,
    );
  });

  it('el borde de Bogotá decide qué es futuro', async () => {
    reloj.fijar('2026-11-11T04:59:59Z'); // todavía 2026-11-10
    await expect(
      service.registrar(5, 3, dto({ fechaRealizada: '2026-11-11' }), []),
    ).rejects.toThrow(BadRequestException);
    reloj.fijar('2026-11-11T05:00:00Z'); // ya 2026-11-11
    await expect(service.registrar(5, 3, dto({ fechaRealizada: '2026-11-11' }), [])).resolves.toBe(
      DETALLE,
    );
  });

  it('fecha anterior a la entrega: 400 con la fecha de entrega; la propia entrega es válida', async () => {
    await expect(
      service.registrar(5, 3, dto({ fechaRealizada: '2026-10-31' }), []),
    ).rejects.toThrow(
      'La fecha realizada no puede ser anterior a la fecha de entrega (2026-11-01)',
    );
    await expect(service.registrar(5, 3, dto({ fechaRealizada: '2026-11-01' }), [])).resolves.toBe(
      DETALLE,
    );
  });

  it('carrera: si bajo bloqueo ya está realizado, 409, rollback y fotos borradas', async () => {
    repo.bloquearParaAccion.mockResolvedValue({ ...FILA, estado: EstadoSeguimiento.Realizado });
    await expect(service.registrar(5, 3, dto(), [foto(1)])).rejects.toThrow(ConflictException);
    expect(repo.registrarResultado).not.toHaveBeenCalled();
    expect(orden).toContain('ELIMINAR privado/seguimientos/ev-1.jpg');
    expect(orden).not.toContain('COMMIT');
    expect(eventos.emit).not.toHaveBeenCalled();
  });

  it('si el UPDATE condicionado no afecta filas: 409, sin evidencias, fotos borradas y sin alerta', async () => {
    repo.registrarResultado.mockResolvedValue(false);
    await expect(
      service.registrar(5, 3, dto({ estadoBienestar: EstadoBienestar.Malo }), [foto(1)]),
    ).rejects.toThrow(ConflictException);
    expect(repo.insertarEvidencias).not.toHaveBeenCalled();
    expect(orden).toContain('ELIMINAR privado/seguimientos/ev-1.jpg');
    expect(eventos.emit).not.toHaveBeenCalled();
  });

  it('si falla el INSERT de las evidencias: borra los archivos, propaga el error original y no alerta', async () => {
    repo.insertarEvidencias.mockRejectedValue(new Error('fallo de la base'));
    await expect(
      service.registrar(5, 3, dto({ estadoBienestar: EstadoBienestar.Malo }), [foto(1), foto(2)]),
    ).rejects.toThrow('fallo de la base');
    expect(orden).toContain('ELIMINAR privado/seguimientos/ev-1.jpg');
    expect(orden).toContain('ELIMINAR privado/seguimientos/ev-2.jpg');
    expect(eventos.emit).not.toHaveBeenCalled();
  });

  it('si falla el guardado de la segunda foto: borra la primera y no abre transacción', async () => {
    storage.guardar
      .mockResolvedValueOnce({ clave: 'privado/seguimientos/a.jpg' })
      .mockRejectedValueOnce(new BadRequestException('Solo se permiten imágenes JPG o PNG'));
    await expect(service.registrar(5, 3, dto(), [foto(1), foto(2)])).rejects.toThrow(
      'Solo se permiten imágenes JPG o PNG',
    );
    expect(storage.eliminar).toHaveBeenCalledWith('privado/seguimientos/a.jpg');
    expect(repo.enTransaccion).not.toHaveBeenCalled();
  });

  it('más de 5 evidencias: 400 antes de tocar nada', async () => {
    const seis = [1, 2, 3, 4, 5, 6].map(foto);
    await expect(service.registrar(5, 3, dto(), seis)).rejects.toThrow(
      new BadRequestException('No puedes adjuntar más de 5 fotos'),
    );
    expect(repo.buscarParaAccion).not.toHaveBeenCalled();
  });

  it('un listener que lanza no rompe la respuesta', async () => {
    eventos.emit.mockImplementation(() => {
      throw new Error('listener roto');
    });
    await expect(
      service.registrar(5, 3, dto({ estadoBienestar: EstadoBienestar.Malo }), []),
    ).resolves.toBe(DETALLE);
  });
});
