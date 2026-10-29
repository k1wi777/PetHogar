import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { FollowUpScheduled } from '../../common/events';
import { RelojSimulado } from '../../common/reloj/reloj-simulado';
import { EstadoAdopcion } from '../adopciones/entities/adopcion.enum';
import { TipoSeguimiento } from './entities/seguimiento.enum';
import type { ProgramarSeguimientoDto } from './dto/programar-seguimiento.dto';
import { SeguimientosService } from './seguimientos.service';

const MANAGER = { id: 'manager' } as never;
// 2026-11-10 a las 03:00 en Bogotá (08:00Z): «hoy» es 2026-11-10.
const AHORA = '2026-11-10T08:00:00Z';
const ADOPCION = {
  id: 9,
  estado: EstadoAdopcion.Activa,
  fechaEntrega: '2026-11-01',
  mascotaId: 4,
};
const DETALLE = { id: 55, adopcionId: 9 };
const dto = (fechaProgramada: string, tipo = TipoSeguimiento.Visita): ProgramarSeguimientoDto =>
  ({ tipo, fechaProgramada }) as ProgramarSeguimientoDto;

function violacion(constraint: string, code = '23505'): QueryFailedError {
  return new QueryFailedError('INSERT', [], Object.assign(new Error('dup'), { code, constraint }));
}

describe('SeguimientosService.programar', () => {
  const orden: string[] = [];
  const repo = {
    enTransaccion: jest.fn(),
    bloquearAdopcionParaProgramar: jest.fn(),
    insertar: jest.fn(),
    obtenerDeFundacion: jest.fn(),
    listarDeFundacion: jest.fn(),
    listarDeAdoptante: jest.fn(),
    obtenerDeAdoptante: jest.fn(),
    resumenPorAdopciones: jest.fn(),
    cancelarPendientesDeAdopcion: jest.fn(),
  };
  const usuarios = { adoptantePorUsuarioId: jest.fn() };
  const eventos = { emit: jest.fn() };
  const reloj = new RelojSimulado(new Date(AHORA));
  const service = new SeguimientosService(
    repo as never,
    usuarios as never,
    eventos as never,
    reloj,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    reloj.fijar(AHORA);
    orden.length = 0;
    repo.enTransaccion.mockImplementation(async (trabajo: (m: unknown) => Promise<unknown>) => {
      orden.push('BEGIN');
      const r = await trabajo(MANAGER);
      orden.push('COMMIT');
      return r;
    });
    repo.bloquearAdopcionParaProgramar.mockResolvedValue(ADOPCION);
    repo.insertar.mockImplementation(() => {
      orden.push('INSERT');
      return Promise.resolve(55);
    });
    repo.obtenerDeFundacion.mockResolvedValue(DETALLE);
    eventos.emit.mockImplementation(() => orden.push('EMIT'));
  });

  it('bloquea la adopción con la fundación, inserta, confirma y solo entonces emite', async () => {
    const resultado = await service.programar(3, 9, dto('2026-12-15'));
    expect(repo.bloquearAdopcionParaProgramar).toHaveBeenCalledWith(MANAGER, 9, 3);
    expect(repo.insertar).toHaveBeenCalledWith(MANAGER, 9, TipoSeguimiento.Visita, '2026-12-15');
    expect(orden).toEqual(['BEGIN', 'INSERT', 'COMMIT', 'EMIT']);
    expect(resultado).toBe(DETALLE);
    expect(repo.obtenerDeFundacion).toHaveBeenCalledWith(55, 3, '2026-11-10');
  });

  it('emite FollowUpScheduled con la medianoche de Bogotá del día programado', async () => {
    await service.programar(3, 9, dto('2026-12-15'));
    const [nombre, evento] = eventos.emit.mock.calls[0] as [string, FollowUpScheduled];
    expect(nombre).toBe(FollowUpScheduled.eventName);
    expect(evento).toBeInstanceOf(FollowUpScheduled);
    expect(evento.seguimientoId).toBe(55);
    expect(evento.adopcionId).toBe(9);
    expect(evento.fechaProgramada.toISOString()).toBe('2026-12-15T05:00:00.000Z');
  });

  it('adopción ajena o inexistente: 404 sin insertar ni emitir', async () => {
    repo.bloquearAdopcionParaProgramar.mockResolvedValue(null);
    await expect(service.programar(3, 9, dto('2026-12-15'))).rejects.toThrow(NotFoundException);
    expect(repo.insertar).not.toHaveBeenCalled();
    expect(eventos.emit).not.toHaveBeenCalled();
    expect(orden).not.toContain('COMMIT');
  });

  it.each([EstadoAdopcion.Finalizada, EstadoAdopcion.Revocada])(
    'adopción %s: 409 con el estado en el mensaje',
    async (estado) => {
      repo.bloquearAdopcionParaProgramar.mockResolvedValue({ ...ADOPCION, estado });
      await expect(service.programar(3, 9, dto('2026-12-15'))).rejects.toThrow(
        new ConflictException(`La adopción ya está ${estado}`),
      );
      expect(repo.insertar).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['2026-11-01', 'posterior a la fecha de entrega (2026-11-01)'],
    ['2026-10-20', 'posterior a la fecha de entrega (2026-11-01)'],
  ])('fecha %s no posterior a la entrega: 400 con la regla', async (fecha, texto) => {
    await expect(service.programar(3, 9, dto(fecha))).rejects.toThrow(BadRequestException);
    await expect(service.programar(3, 9, dto(fecha))).rejects.toThrow(texto);
    expect(repo.insertar).not.toHaveBeenCalled();
    expect(eventos.emit).not.toHaveBeenCalled();
  });

  it('fecha anterior a hoy: 400; hoy es válido', async () => {
    await expect(service.programar(3, 9, dto('2026-11-09'))).rejects.toThrow(
      'La fecha del seguimiento no puede ser anterior a hoy',
    );
    await expect(service.programar(3, 9, dto('2026-11-10'))).resolves.toBe(DETALLE);
  });

  it('el borde del día usa Bogotá: a las 04:59Z de otro día «hoy» sigue siendo el anterior', async () => {
    reloj.fijar('2026-11-11T04:59:59Z'); // todavía 2026-11-10 en Bogotá
    await expect(service.programar(3, 9, dto('2026-11-10'))).resolves.toBe(DETALLE);
    reloj.fijar('2026-11-11T05:00:00Z'); // ya es 2026-11-11
    await expect(service.programar(3, 9, dto('2026-11-10'))).rejects.toThrow(BadRequestException);
  });

  it('violación de uq_seguimiento_pendiente: 409 claro y sin evento', async () => {
    repo.insertar.mockRejectedValue(violacion('uq_seguimiento_pendiente'));
    await expect(service.programar(3, 9, dto('2026-12-15'))).rejects.toThrow(
      new ConflictException('Ya hay un seguimiento de ese tipo programado para esa fecha'),
    );
    expect(eventos.emit).not.toHaveBeenCalled();
    expect(orden).not.toContain('COMMIT');
  });

  it('cualquier otro error de la base se propaga tal cual', async () => {
    const otro = violacion('otra_restriccion');
    repo.insertar.mockRejectedValue(otro);
    await expect(service.programar(3, 9, dto('2026-12-15'))).rejects.toBe(otro);
    repo.insertar.mockRejectedValue(new Error('caída'));
    await expect(service.programar(3, 9, dto('2026-12-15'))).rejects.toThrow('caída');
  });

  it('un listener que lanza no rompe la respuesta', async () => {
    eventos.emit.mockImplementation(() => {
      throw new Error('listener roto');
    });
    await expect(service.programar(3, 9, dto('2026-12-15'))).resolves.toBe(DETALLE);
    expect(Logger.prototype.error).toHaveBeenCalled();
  });
});

describe('SeguimientosService (lecturas y piezas para adopciones)', () => {
  const repo = {
    obtenerDeFundacion: jest.fn(),
    listarDeFundacion: jest.fn(),
    listarDeAdoptante: jest.fn(),
    obtenerDeAdoptante: jest.fn(),
    resumenPorAdopciones: jest.fn(),
    cancelarPendientesDeAdopcion: jest.fn(),
    buscarParaAviso: jest.fn(),
  };
  const usuarios = { adoptantePorUsuarioId: jest.fn() };
  const reloj = new RelojSimulado(new Date(AHORA));
  const service = new SeguimientosService(repo as never, usuarios as never, {} as never, reloj);
  const paginacion = { page: 2, limit: 5 } as never;

  beforeEach(() => {
    jest.resetAllMocks();
    usuarios.adoptantePorUsuarioId.mockResolvedValue({ id: 8 });
  });

  it('la lista de la fundación pasa el filtro, hoy de Bogotá y el desplazamiento', async () => {
    repo.listarDeFundacion.mockResolvedValue([[{ id: 1 }], 11]);
    const filtro = { estado: undefined, adopcionId: 9 };
    const pagina = await service.listarDeFundacion(3, filtro, paginacion);
    expect(repo.listarDeFundacion).toHaveBeenCalledWith(3, filtro, '2026-11-10', 5, 5);
    expect(pagina).toEqual({ data: [{ id: 1 }], total: 11, page: 2, limit: 5 });
  });

  it('la lista del adoptante usa su id de adoptante, no el del usuario', async () => {
    repo.listarDeAdoptante.mockResolvedValue([[], 0]);
    await service.listarMios(21, {}, paginacion);
    expect(usuarios.adoptantePorUsuarioId).toHaveBeenCalledWith(21);
    expect(repo.listarDeAdoptante.mock.calls[0][0]).toBe(8);
  });

  it('el detalle del adoptante usa su id de adoptante y el día de hoy de Bogotá', async () => {
    usuarios.adoptantePorUsuarioId.mockResolvedValue({ id: 8 });
    repo.obtenerDeAdoptante.mockResolvedValue({ id: 5, vencido: true });
    await expect(service.obtenerMio(21, 5)).resolves.toEqual({ id: 5, vencido: true });
    expect(repo.obtenerDeAdoptante).toHaveBeenCalledWith(5, 8, '2026-11-10');
  });

  it('un usuario sin perfil de adoptante recibe 403', async () => {
    usuarios.adoptantePorUsuarioId.mockResolvedValue(null);
    await expect(service.listarMios(21, {}, paginacion)).rejects.toThrow(ForbiddenException);
    await expect(service.obtenerMio(21, 1)).rejects.toThrow(ForbiddenException);
  });

  it('un detalle ajeno o inexistente es el mismo 404 para ambos roles', async () => {
    repo.obtenerDeFundacion.mockResolvedValue(null);
    repo.obtenerDeAdoptante.mockResolvedValue(null);
    await expect(service.obtenerDeFundacion(3, 1)).rejects.toThrow(
      new NotFoundException('El seguimiento no existe'),
    );
    await expect(service.obtenerMio(21, 1)).rejects.toThrow(
      new NotFoundException('El seguimiento no existe'),
    );
  });

  it('resumenPorAdopciones delega con el día de hoy de Bogotá', async () => {
    const mapa = new Map();
    repo.resumenPorAdopciones.mockResolvedValue(mapa);
    await expect(service.resumenPorAdopciones([1, 2])).resolves.toBe(mapa);
    expect(repo.resumenPorAdopciones).toHaveBeenCalledWith([1, 2], '2026-11-10');
  });

  it('cancelarPendientesDeAdopcion usa el manager del orquestador y cuenta las canceladas', async () => {
    repo.cancelarPendientesDeAdopcion.mockResolvedValue([4, 5]);
    await expect(service.cancelarPendientesDeAdopcion(9, MANAGER)).resolves.toBe(2);
    expect(repo.cancelarPendientesDeAdopcion).toHaveBeenCalledWith(MANAGER, 9);
  });

  it('datosParaAviso delega en el repository y devuelve null si no existe', async () => {
    const datos = { adopcionId: 9, mascotaNombre: 'Rocky' };
    repo.buscarParaAviso.mockResolvedValueOnce(datos).mockResolvedValueOnce(null);
    await expect(service.datosParaAviso(5)).resolves.toBe(datos);
    await expect(service.datosParaAviso(6)).resolves.toBeNull();
    expect(repo.buscarParaAviso).toHaveBeenCalledWith(5);
  });
});
