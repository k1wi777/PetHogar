import { ConflictException, NotFoundException } from '@nestjs/common';
import { EstadoValidacion } from './entities/fundacion.enum';
import type { Fundacion } from './entities/fundacion.entity';
import { FundacionesRepository } from './fundaciones.repository';
import { FundacionesService } from './fundaciones.service';
import { type DecisionValidacion, TRANSICIONES } from './fundaciones.types';

const FILA = {
  id: 3,
  usuarioId: 9,
  nombre: 'Huellas',
  nit: '900123456-7',
  documentoUrl: 'privado/fundaciones/x.pdf',
  estadoValidacion: EstadoValidacion.Pendiente,
  observacionValidacion: 'texto interno',
} as Fundacion;

function crear(): { service: FundacionesService; repo: jest.Mocked<FundacionesRepository> } {
  const repo = {
    crear: jest.fn(),
    existeNit: jest.fn(),
    buscarPorUsuarioId: jest.fn(),
    buscarPorId: jest.fn(),
    listarPorEstado: jest.fn(),
    buscarPorUsuarioIds: jest.fn(),
    decidirValidacion: jest.fn(),
  } as unknown as jest.Mocked<FundacionesRepository>;
  return { service: new FundacionesService(repo), repo };
}

describe('FundacionesService', () => {
  it('crea la fundación con el EntityManager recibido y devuelve solo el resumen', async () => {
    const { service, repo } = crear();
    repo.crear.mockResolvedValue(FILA);
    const manager = {} as never;
    const datos = {
      usuarioId: 9,
      nombre: 'Huellas',
      nit: '900123456-7',
      direccion: 'Calle 1',
      ciudad: 'Montería',
      descripcion: null,
      documentoClave: 'privado/fundaciones/x.pdf',
    };
    const r = await service.crear(datos, manager);
    expect(repo.crear).toHaveBeenCalledWith(datos, manager);
    expect(r).toEqual({
      id: 3,
      nombre: 'Huellas',
      estadoValidacion: 'pendiente',
      observacionValidacion: null,
    });
    expect(r).not.toHaveProperty('documentoUrl');
  });

  it('solo expone la observación cuando la fundación fue rechazada', async () => {
    const { service, repo } = crear();
    repo.buscarPorUsuarioId.mockResolvedValue({
      ...FILA,
      estadoValidacion: EstadoValidacion.Rechazada,
      observacionValidacion: 'Documento ilegible',
    });
    expect(await service.obtenerPorUsuarioId(9)).toMatchObject({
      estadoValidacion: 'rechazada',
      observacionValidacion: 'Documento ilegible',
    });
  });

  it('devuelve null si el usuario no tiene fundación', async () => {
    const { service, repo } = crear();
    repo.buscarPorUsuarioId.mockResolvedValue(null);
    expect(await service.estadoPorUsuarioId(1)).toBeNull();
  });

  describe('consultas del administrador', () => {
    const COMPLETA = {
      ...FILA,
      direccion: 'Calle 1',
      ciudad: 'Montería',
      descripcion: null,
      fechaValidacion: null,
    } as Fundacion;

    it('lista paginado por estado en el orden del repository y mapea sin clave de documento', async () => {
      const { service, repo } = crear();
      repo.listarPorEstado.mockResolvedValue([[COMPLETA], 11]);
      const r = await service.listarPorEstado(EstadoValidacion.Pendiente, { page: 2, limit: 5 });
      expect(repo.listarPorEstado).toHaveBeenCalledWith('pendiente', 5, 5);
      expect(r).toMatchObject({ total: 11, page: 2, limit: 5 });
      expect(r.data[0]).toEqual({
        id: 3,
        nombre: 'Huellas',
        nit: '900123456-7',
        ciudad: 'Montería',
        estadoValidacion: 'pendiente',
        fechaValidacion: null,
      });
      expect(JSON.stringify(r)).not.toContain('privado/');
    });

    it('el detalle lleva dirección y observación; la clave solo sale por obtenerClaveDocumento', async () => {
      const { service, repo } = crear();
      repo.buscarPorId.mockResolvedValue(COMPLETA);
      const d = await service.obtenerDetalle(3);
      expect(d).toMatchObject({
        usuarioId: 9,
        direccion: 'Calle 1',
        observacionValidacion: 'texto interno',
      });
      expect(d).not.toHaveProperty('documentoUrl');
      expect(await service.obtenerClaveDocumento(3)).toBe('privado/fundaciones/x.pdf');
    });

    it('fundación inexistente: 404 en detalle y documento', async () => {
      const { service, repo } = crear();
      repo.buscarPorId.mockResolvedValue(null);
      await expect(service.obtenerDetalle(1)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.obtenerClaveDocumento(1)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('decidirValidacion (máquina de estados)', () => {
    const ESTADOS = [
      EstadoValidacion.Pendiente,
      EstadoValidacion.Aprobada,
      EstadoValidacion.Rechazada,
    ];
    const AHORA = new Date('2026-10-29T12:00:00Z');

    it('la tabla solo permite pendiente→aprobada, rechazada→aprobada y pendiente→rechazada', () => {
      expect(TRANSICIONES).toEqual({
        aprobada: ['pendiente', 'rechazada'],
        rechazada: ['pendiente'],
      });
    });

    /** El repository simulado reproduce el UPDATE condicionado sobre un estado mutable. */
    function conEstado(inicial: EstadoValidacion) {
      const { service, repo } = crear();
      const fila = { ...FILA, estadoValidacion: inicial } as Fundacion;
      repo.buscarPorId.mockImplementation(async () => ({ ...fila }) as Fundacion);
      repo.decidirValidacion.mockImplementation(async (_id, destino, origenes, obs, fecha) => {
        if (!origenes.includes(fila.estadoValidacion)) return false;
        Object.assign(fila, {
          estadoValidacion: destino,
          observacionValidacion: obs,
          fechaValidacion: fecha,
        });
        return true;
      });
      return { service, repo, fila };
    }

    const DESTINOS: DecisionValidacion[] = [EstadoValidacion.Aprobada, EstadoValidacion.Rechazada];
    const casos = ESTADOS.flatMap((origen) =>
      DESTINOS.map((destino) => [origen, destino] as const),
    );

    it.each(casos)('%s → %s', async (origen, destino) => {
      const { service, fila } = conEstado(origen);
      const permitida = TRANSICIONES[destino].includes(origen);
      const resultado = service.decidirValidacion(3, destino, 'motivo', AHORA);
      if (permitida) {
        const d = await resultado;
        expect(d).toMatchObject({ estadoValidacion: destino, observacionValidacion: 'motivo' });
        expect(fila.fechaValidacion).toEqual(AHORA);
      } else {
        await expect(resultado).rejects.toBeInstanceOf(ConflictException);
        expect(fila.estadoValidacion).toBe(origen);
        expect(fila.fechaValidacion).toBeUndefined();
      }
    });

    it('nunca vuelve a pendiente: el destino pendiente no existe en la tabla', () => {
      expect(Object.keys(TRANSICIONES)).not.toContain('pendiente');
    });

    it('el 409 distingue repetir la decisión de una transición no permitida', async () => {
      const a = conEstado(EstadoValidacion.Aprobada);
      await expect(a.service.decidirValidacion(3, EstadoValidacion.Aprobada, null)).rejects.toThrow(
        'ya está en estado «aprobada»',
      );
      await expect(a.service.decidirValidacion(3, EstadoValidacion.Rechazada, 'x')).rejects.toThrow(
        'de «aprobada» a «rechazada»',
      );
    });

    it('aprobar tras un rechazo sobrescribe el motivo anterior', async () => {
      const { service } = conEstado(EstadoValidacion.Rechazada);
      const d = await service.decidirValidacion(3, EstadoValidacion.Aprobada, null, AHORA);
      expect(d.observacionValidacion).toBeNull();
    });

    it('fundación inexistente: 404 (no 409)', async () => {
      const { service, repo } = crear();
      repo.decidirValidacion.mockResolvedValue(false);
      repo.buscarPorId.mockResolvedValue(null);
      await expect(
        service.decidirValidacion(99, EstadoValidacion.Aprobada, null),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('dos decisiones simultáneas: solo una se aplica', async () => {
      const { service } = conEstado(EstadoValidacion.Pendiente);
      const r = await Promise.allSettled([
        service.decidirValidacion(3, EstadoValidacion.Aprobada, null),
        service.decidirValidacion(3, EstadoValidacion.Aprobada, null),
      ]);
      expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
      expect(
        (r.find((x) => x.status === 'rejected') as PromiseRejectedResult).reason,
      ).toBeInstanceOf(ConflictException);
    });
  });

  describe('lecturas para otros módulos', () => {
    it('datosBasicos devuelve solo id, nombre, usuario y estado (sin documento ni observación)', async () => {
      const { service, repo } = crear();
      repo.buscarPorId.mockResolvedValue(FILA);
      await expect(service.datosBasicos(3)).resolves.toEqual({
        id: 3,
        nombre: 'Huellas',
        usuarioId: 9,
        estadoValidacion: EstadoValidacion.Pendiente,
      });
    });

    it('datosBasicos devuelve null si no existe', async () => {
      const { service, repo } = crear();
      repo.buscarPorId.mockResolvedValue(null);
      await expect(service.datosBasicos(3)).resolves.toBeNull();
    });

    it('nombresPorUsuarioIds indexa por usuario y no consulta con una lista vacía', async () => {
      const { service, repo } = crear();
      repo.buscarPorUsuarioIds.mockResolvedValue([FILA]);
      await expect(service.nombresPorUsuarioIds([9, 10])).resolves.toEqual(
        new Map([[9, 'Huellas']]),
      );
      await expect(service.nombresPorUsuarioIds([])).resolves.toEqual(new Map());
      expect(repo.buscarPorUsuarioIds).toHaveBeenCalledTimes(1);
    });
  });
});
