import { ConflictException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { AdoptionRejected, AdoptionRequestCreated } from '../../common/events';
import { EstadoMascota } from '../mascotas/entities/mascota.enum';
import type { CrearSolicitudDto } from './dto/crear-solicitud.dto';
import { EstadoSolicitud } from './entities/solicitud-adopcion.enum';
import { OBSERVACION_AUTOMATICA, SolicitudesService } from './solicitudes.service';

const USUARIO = { id: 9, rol: 'adoptante' } as const;
const DTO = {
  mascotaId: 7,
  motivo: 'Quiero darle un hogar',
  tipoVivienda: 'casa',
  tieneOtrasMascotas: false,
} as CrearSolicitudDto;
const MASCOTA = { id: 7, estado: EstadoMascota.Disponible, fundacionId: 3, fundacionUsuarioId: 50 };
const DETALLE = { id: 11, estado: EstadoSolicitud.Pendiente };
const PDF = Buffer.from('%PDF-1.7');

function violacion(constraint: string): QueryFailedError {
  return new QueryFailedError('INSERT', [], { code: '23505', constraint } as never);
}

describe('SolicitudesService', () => {
  const repo = {
    insertar: jest.fn(),
    existePendiente: jest.fn(),
    listarDeAdoptante: jest.fn(),
    obtenerDeAdoptante: jest.fn(),
    buscarEstadoDeAdoptante: jest.fn(),
    cancelar: jest.fn(),
    listarDeFundacion: jest.fn(),
    obtenerDeFundacion: jest.fn(),
    buscarEstadoDeFundacion: jest.fn(),
    decidir: jest.fn(),
    rechazarPendientesDeMascota: jest.fn(),
  };
  const mascotas = { obtenerParaSolicitud: jest.fn() };
  const usuarios = { adoptantePorUsuarioId: jest.fn() };
  const storage = { guardar: jest.fn(), eliminar: jest.fn() };
  const eventos = { emit: jest.fn() };
  const service = new SolicitudesService(
    repo as never,
    mascotas as never,
    usuarios as never,
    storage as never,
    eventos as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    usuarios.adoptantePorUsuarioId.mockResolvedValue({ id: 4, usuarioId: 9 });
    mascotas.obtenerParaSolicitud.mockResolvedValue(MASCOTA);
    repo.existePendiente.mockResolvedValue(false);
    storage.guardar.mockResolvedValue({ clave: 'privado/solicitudes/f.pdf' });
    repo.insertar.mockResolvedValue(11);
    repo.obtenerDeAdoptante.mockResolvedValue(DETALLE);
  });

  describe('crear', () => {
    it('guarda el formulario privado, inserta y emite el evento con los ids correctos', async () => {
      const r = await service.crear(USUARIO, DTO, PDF);
      expect(storage.guardar).toHaveBeenCalledWith(
        { buffer: PDF },
        { categoria: 'documento', carpeta: 'solicitudes' },
      );
      expect(repo.insertar).toHaveBeenCalledWith({
        adoptanteId: 4,
        mascotaId: 7,
        motivo: DTO.motivo,
        tipoVivienda: 'casa',
        tieneOtrasMascotas: false,
        formularioClave: 'privado/solicitudes/f.pdf',
      });
      expect(eventos.emit).toHaveBeenCalledWith(
        AdoptionRequestCreated.eventName,
        new AdoptionRequestCreated(11, 7, 3, 4),
      );
      expect(r).toBe(DETALLE);
    });

    it('sin archivo o vacío: 400 sin tocar nada', async () => {
      await expect(service.crear(USUARIO, DTO)).rejects.toThrow('Debes adjuntar el formulario');
      await expect(service.crear(USUARIO, DTO, Buffer.alloc(0))).rejects.toThrow('vacío');
      expect(mascotas.obtenerParaSolicitud).not.toHaveBeenCalled();
      expect(storage.guardar).not.toHaveBeenCalled();
    });

    it('un usuario sin perfil de adoptante es 403', async () => {
      usuarios.adoptantePorUsuarioId.mockResolvedValue(null);
      await expect(service.crear(USUARIO, DTO, PDF)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('mascota inexistente: se propaga el 404 y no se guarda archivo', async () => {
      mascotas.obtenerParaSolicitud.mockRejectedValue(
        new NotFoundException('La mascota no existe'),
      );
      await expect(service.crear(USUARIO, DTO, PDF)).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.guardar).not.toHaveBeenCalled();
    });

    it.each([EstadoMascota.EnProceso, EstadoMascota.Adoptada, EstadoMascota.Inactiva])(
      'mascota %s: 409 sin guardar archivo ni insertar',
      async (estado) => {
        mascotas.obtenerParaSolicitud.mockResolvedValue({ ...MASCOTA, estado });
        await expect(service.crear(USUARIO, DTO, PDF)).rejects.toThrow(
          'La mascota ya no está disponible para adopción',
        );
        expect(storage.guardar).not.toHaveBeenCalled();
        expect(repo.insertar).not.toHaveBeenCalled();
      },
    );

    it('comprobación defensiva: el titular de la fundación de la mascota es 403', async () => {
      mascotas.obtenerParaSolicitud.mockResolvedValue({ ...MASCOTA, fundacionUsuarioId: 9 });
      await expect(service.crear(USUARIO, DTO, PDF)).rejects.toThrow('tu propia fundación');
      expect(storage.guardar).not.toHaveBeenCalled();
    });

    it('duplicada detectada por la precomprobación: 409 antes de guardar el archivo', async () => {
      repo.existePendiente.mockResolvedValue(true);
      await expect(service.crear(USUARIO, DTO, PDF)).rejects.toThrow(
        'Ya tienes una solicitud activa para esta mascota',
      );
      expect(storage.guardar).not.toHaveBeenCalled();
    });

    it('duplicada por carrera (23505 de uq_solicitud_pendiente): mismo 409 y borra el archivo', async () => {
      repo.insertar.mockRejectedValue(violacion('uq_solicitud_pendiente'));
      await expect(service.crear(USUARIO, DTO, PDF)).rejects.toThrow(
        'Ya tienes una solicitud activa para esta mascota',
      );
      expect(storage.eliminar).toHaveBeenCalledWith('privado/solicitudes/f.pdf');
      expect(eventos.emit).not.toHaveBeenCalled();
    });

    it('otro fallo del INSERT se propaga tal cual y limpia el archivo', async () => {
      const error = new Error('conexión perdida');
      repo.insertar.mockRejectedValue(error);
      await expect(service.crear(USUARIO, DTO, PDF)).rejects.toBe(error);
      expect(storage.eliminar).toHaveBeenCalledWith('privado/solicitudes/f.pdf');
    });

    it('un 23505 de otra restricción no se traduce a 409', async () => {
      const error = violacion('otra');
      repo.insertar.mockRejectedValue(error);
      await expect(service.crear(USUARIO, DTO, PDF)).rejects.toBe(error);
    });

    it('si falla el guardado no hay nada que limpiar ni evento', async () => {
      const error = new Error('disco lleno');
      storage.guardar.mockRejectedValue(error);
      await expect(service.crear(USUARIO, DTO, PDF)).rejects.toBe(error);
      expect(storage.eliminar).not.toHaveBeenCalled();
      expect(repo.insertar).not.toHaveBeenCalled();
    });

    it('un fallo al limpiar el archivo no oculta el error original', async () => {
      const error = new Error('insert roto');
      repo.insertar.mockRejectedValue(error);
      storage.eliminar.mockRejectedValue(new Error('no se pudo borrar'));
      await expect(service.crear(USUARIO, DTO, PDF)).rejects.toBe(error);
    });

    it('un listener que lanza no rompe la respuesta', async () => {
      eventos.emit.mockImplementation(() => {
        throw new Error('listener');
      });
      await expect(service.crear(USUARIO, DTO, PDF)).resolves.toBe(DETALLE);
    });
  });

  describe('del adoptante', () => {
    it('lista solo por su adoptante, con filtro y desplazamiento', async () => {
      repo.listarDeAdoptante.mockResolvedValue([[{ id: 1 }], 21]);
      const r = await service.listarMias(
        9,
        { estado: EstadoSolicitud.Pendiente },
        {
          page: 3,
          limit: 10,
        },
      );
      expect(repo.listarDeAdoptante).toHaveBeenCalledWith(
        4,
        { estado: EstadoSolicitud.Pendiente },
        20,
        10,
      );
      expect(r).toEqual({ data: [{ id: 1 }], total: 21, page: 3, limit: 10 });
    });

    it('el detalle ajeno o inexistente es 404', async () => {
      repo.obtenerDeAdoptante.mockResolvedValue(null);
      await expect(service.obtenerMia(9, 99)).rejects.toThrow('La solicitud no existe');
      expect(repo.obtenerDeAdoptante).toHaveBeenCalledWith(99, 4);
    });

    it('cancela una pendiente propia y devuelve el detalle', async () => {
      repo.cancelar.mockResolvedValue(true);
      expect(await service.cancelar(9, 11)).toBe(DETALLE);
      expect(repo.cancelar).toHaveBeenCalledWith(11, 4);
    });

    it('cancelar una ajena o inexistente: 404', async () => {
      repo.cancelar.mockResolvedValue(false);
      repo.buscarEstadoDeAdoptante.mockResolvedValue(null);
      await expect(service.cancelar(9, 11)).rejects.toBeInstanceOf(NotFoundException);
    });

    it.each([
      [
        EstadoSolicitud.Aprobada,
        'Una solicitud aprobada no se puede cancelar; contacta a la fundación',
      ],
      [EstadoSolicitud.Rechazada, 'La solicitud ya está rechazada'],
      [EstadoSolicitud.Cancelada, 'La solicitud ya está cancelada'],
    ])('cancelar una %s: 409 con su mensaje', async (estado, mensaje) => {
      repo.cancelar.mockResolvedValue(false);
      repo.buscarEstadoDeAdoptante.mockResolvedValue(estado);
      const error = await service.cancelar(9, 11).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).message).toBe(mensaje);
    });
  });

  describe('de la fundación', () => {
    it('lista con propiedad, filtros y orden delegado al repository', async () => {
      repo.listarDeFundacion.mockResolvedValue([[], 0]);
      await service.listarDeFundacion(3, { mascotaId: 7 }, { page: 1, limit: 10 });
      expect(repo.listarDeFundacion).toHaveBeenCalledWith(3, { mascotaId: 7 }, 0, 10);
    });

    it('detalle de una solicitud de mascota ajena: 404 uniforme', async () => {
      repo.obtenerDeFundacion.mockResolvedValue(null);
      await expect(service.obtenerDeFundacion(11, 3)).rejects.toThrow('La solicitud no existe');
      expect(repo.obtenerDeFundacion).toHaveBeenCalledWith(11, 3);
    });

    it('rechaza una pendiente y emite AdoptionRejected (no automático) tras el UPDATE', async () => {
      repo.decidir.mockResolvedValue({ id: 11, mascotaId: 7, adoptanteId: 4 });
      repo.obtenerDeFundacion.mockResolvedValue({ id: 11, estado: 'rechazada' });
      await service.rechazar(11, 3, 'No cumple los requisitos');
      expect(repo.decidir).toHaveBeenCalledWith(
        11,
        3,
        EstadoSolicitud.Rechazada,
        'No cumple los requisitos',
      );
      expect(eventos.emit).toHaveBeenCalledWith(
        AdoptionRejected.eventName,
        new AdoptionRejected(11, 7, 3, 4, 'No cumple los requisitos', false),
      );
    });

    it('rechazar una ajena: 404 sin evento', async () => {
      repo.decidir.mockResolvedValue(null);
      repo.buscarEstadoDeFundacion.mockResolvedValue(null);
      await expect(service.rechazar(11, 3, 'x')).rejects.toBeInstanceOf(NotFoundException);
      expect(eventos.emit).not.toHaveBeenCalled();
    });

    it('rechazar una ya decidida: 409 con su estado y sin evento', async () => {
      repo.decidir.mockResolvedValue(null);
      repo.buscarEstadoDeFundacion.mockResolvedValue(EstadoSolicitud.Aprobada);
      await expect(service.rechazar(11, 3, 'x')).rejects.toThrow('La solicitud ya está aprobada');
      expect(eventos.emit).not.toHaveBeenCalled();
    });
  });

  describe('piezas de la aprobación', () => {
    const manager = {} as never;

    it('aprobar usa el manager y el UPDATE condicionado a pendiente', async () => {
      repo.decidir.mockResolvedValue({ id: 11, mascotaId: 7, adoptanteId: 4 });
      const r = await service.aprobar(11, 3, null, manager);
      expect(repo.decidir).toHaveBeenCalledWith(11, 3, EstadoSolicitud.Aprobada, null, manager);
      expect(r).toEqual({ id: 11, mascotaId: 7, adoptanteId: 4 });
    });

    it('aprobar una ya decidida: 409 (la relectura usa el manager de la transacción)', async () => {
      repo.decidir.mockResolvedValue(null);
      repo.buscarEstadoDeFundacion.mockResolvedValue(EstadoSolicitud.Rechazada);
      await expect(service.aprobar(11, 3, null, manager)).rejects.toThrow(
        'La solicitud ya está rechazada',
      );
      expect(repo.buscarEstadoDeFundacion).toHaveBeenCalledWith(11, 3, manager);
    });

    it('aprobar una ajena: 404', async () => {
      repo.decidir.mockResolvedValue(null);
      repo.buscarEstadoDeFundacion.mockResolvedValue(null);
      await expect(service.aprobar(11, 3, null, manager)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('las demás pendientes se rechazan con la observación automática', async () => {
      repo.rechazarPendientesDeMascota.mockResolvedValue([{ id: 12, adoptanteId: 5 }]);
      expect(await service.rechazarPendientesDeMascota(7, manager)).toEqual([
        { id: 12, adoptanteId: 5 },
      ]);
      expect(repo.rechazarPendientesDeMascota).toHaveBeenCalledWith(
        7,
        OBSERVACION_AUTOMATICA,
        manager,
      );
      expect(OBSERVACION_AUTOMATICA.length).toBeLessThanOrEqual(300);
    });
  });
});
