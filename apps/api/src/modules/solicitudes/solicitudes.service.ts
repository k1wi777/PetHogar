import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { EntityManager } from 'typeorm';
import { QueryFailedError } from 'typeorm';
import { emitirSeguro } from '../../common/events/emitir-seguro';
import { AdoptionRejected, AdoptionRequestCreated } from '../../common/events';
import type { UsuarioAutenticado } from '../../common/auth/usuario-autenticado';
import { desplazamiento, type Paginado, paginar } from '../../common/pagination/paginar';
import type { PaginacionQueryDto } from '../../common/pagination/paginacion-query.dto';
import { EstadoMascota } from '../mascotas/entities/mascota.enum';
import { MascotasService } from '../mascotas/mascotas.service';
import { MENSAJE_ARCHIVO_VACIO } from '../storage/storage.constants';
import { STORAGE_SERVICE, type IStorageService } from '../storage/storage.interface';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { CrearSolicitudDto } from './dto/crear-solicitud.dto';
import { EstadoSolicitud } from './entities/solicitud-adopcion.enum';
import { SolicitudesRepository } from './solicitudes.repository';
import {
  MENSAJE_SOLICITUD_NO_EXISTE,
  type FiltroSolicitudesAdoptante,
  type FiltroSolicitudesFundacion,
  type SolicitudDecidida,
  type SolicitudDetalleAdoptante,
  type SolicitudDetalleFundacion,
  type SolicitudResumenAdoptante,
  type SolicitudResumenFundacion,
} from './solicitudes.types';

const CONSTRAINT_PENDIENTE = 'uq_solicitud_pendiente';
const MENSAJE_DUPLICADA = 'Ya tienes una solicitud activa para esta mascota';
const MENSAJE_NO_DISPONIBLE = 'La mascota ya no está disponible para adopción';
const MENSAJE_PROPIA_FUNDACION = 'No puedes solicitar una mascota de tu propia fundación';

/** Rechazo automático de las demás solicitudes cuando se aprueba una (≤ 300 caracteres). */
export const OBSERVACION_AUTOMATICA =
  'La mascota ya fue adoptada: la fundación aprobó otra solicitud.';

/** Dueño de `solicitud_adopcion`: crear, consultar, cancelar y rechazar. Devuelve objetos de dominio. */
@Injectable()
export class SolicitudesService {
  private readonly logger = new Logger(SolicitudesService.name);

  constructor(
    private readonly repo: SolicitudesRepository,
    private readonly mascotas: MascotasService,
    private readonly usuarios: UsuariosService,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
    private readonly eventos: EventEmitter2,
  ) {}

  /**
   * Crea una solicitud pendiente. La mascota sigue `disponible` (otras personas pueden solicitarla
   * también). El archivo se guarda antes del INSERT y se borra si este falla.
   */
  async crear(
    usuario: UsuarioAutenticado,
    dto: CrearSolicitudDto,
    archivo?: Buffer,
  ): Promise<SolicitudDetalleAdoptante> {
    if (!archivo) throw new BadRequestException('Debes adjuntar el formulario firmado');
    if (archivo.length === 0) throw new BadRequestException(MENSAJE_ARCHIVO_VACIO);
    const adoptanteId = await this.adoptanteIdDe(usuario.id);

    const mascota = await this.mascotas.obtenerParaSolicitud(dto.mascotaId);
    if (mascota.estado !== EstadoMascota.Disponible) {
      throw new ConflictException(MENSAJE_NO_DISPONIBLE);
    }
    // Defensa en profundidad: un usuario tiene un único rol, así que no hay camino real hasta aquí.
    if (mascota.fundacionUsuarioId === usuario.id) {
      throw new ForbiddenException(MENSAJE_PROPIA_FUNDACION);
    }
    if (await this.repo.existePendiente(adoptanteId, dto.mascotaId)) {
      throw new ConflictException(MENSAJE_DUPLICADA);
    }

    let clave: string | undefined;
    let solicitudId: number;
    try {
      const guardado = await this.storage.guardar(
        { buffer: archivo },
        { categoria: 'documento', carpeta: 'solicitudes' },
      );
      clave = guardado.clave;
      solicitudId = await this.repo.insertar({
        adoptanteId,
        mascotaId: dto.mascotaId,
        motivo: dto.motivo,
        tipoVivienda: dto.tipoVivienda,
        tieneOtrasMascotas: dto.tieneOtrasMascotas,
        formularioClave: clave,
      });
    } catch (error) {
      if (clave) await this.eliminarArchivo(clave);
      throw esViolacionDePendiente(error) ? new ConflictException(MENSAJE_DUPLICADA) : error;
    }

    emitirSeguro(
      this.eventos,
      AdoptionRequestCreated.eventName,
      new AdoptionRequestCreated(solicitudId, mascota.id, mascota.fundacionId, adoptanteId),
      this.logger,
    );
    return this.obtenerDeAdoptante(adoptanteId, solicitudId);
  }

  // ---- Adoptante ---------------------------------------------------------------------------

  async listarMias(
    usuarioId: number,
    filtro: FiltroSolicitudesAdoptante,
    paginacion: PaginacionQueryDto,
  ): Promise<Paginado<SolicitudResumenAdoptante>> {
    const adoptanteId = await this.adoptanteIdDe(usuarioId);
    const { skip, take } = desplazamiento(paginacion);
    const [filas, total] = await this.repo.listarDeAdoptante(adoptanteId, filtro, skip, take);
    return paginar(filas, total, paginacion);
  }

  async obtenerMia(usuarioId: number, id: number): Promise<SolicitudDetalleAdoptante> {
    return this.obtenerDeAdoptante(await this.adoptanteIdDe(usuarioId), id);
  }

  /** Solo una solicitud propia y pendiente; no toca la mascota ni emite eventos. */
  async cancelar(usuarioId: number, id: number): Promise<SolicitudDetalleAdoptante> {
    const adoptanteId = await this.adoptanteIdDe(usuarioId);
    if (!(await this.repo.cancelar(id, adoptanteId))) {
      const estado = await this.repo.buscarEstadoDeAdoptante(id, adoptanteId);
      if (!estado) throw new NotFoundException(MENSAJE_SOLICITUD_NO_EXISTE);
      throw new ConflictException(
        estado === EstadoSolicitud.Aprobada
          ? 'Una solicitud aprobada no se puede cancelar; contacta a la fundación'
          : `La solicitud ya está ${estado}`,
      );
    }
    return this.obtenerDeAdoptante(adoptanteId, id);
  }

  // ---- Fundación ---------------------------------------------------------------------------

  async listarDeFundacion(
    fundacionId: number,
    filtro: FiltroSolicitudesFundacion,
    paginacion: PaginacionQueryDto,
  ): Promise<Paginado<SolicitudResumenFundacion>> {
    const { skip, take } = desplazamiento(paginacion);
    const [filas, total] = await this.repo.listarDeFundacion(fundacionId, filtro, skip, take);
    return paginar(filas, total, paginacion);
  }

  async obtenerDeFundacion(id: number, fundacionId: number): Promise<SolicitudDetalleFundacion> {
    const solicitud = await this.repo.obtenerDeFundacion(id, fundacionId);
    if (!solicitud) throw new NotFoundException(MENSAJE_SOLICITUD_NO_EXISTE);
    return solicitud;
  }

  /** Un único UPDATE condicionado: la sentencia ya es atómica, el evento sale tras confirmarse. */
  async rechazar(
    id: number,
    fundacionId: number,
    observacion: string,
  ): Promise<SolicitudDetalleFundacion> {
    const decidida = await this.repo.decidir(
      id,
      fundacionId,
      EstadoSolicitud.Rechazada,
      observacion,
    );
    if (!decidida) return this.explicarRechazo(id, fundacionId);
    emitirSeguro(
      this.eventos,
      AdoptionRejected.eventName,
      new AdoptionRejected(
        id,
        decidida.mascotaId,
        fundacionId,
        decidida.adoptanteId,
        observacion,
        false,
      ),
      this.logger,
    );
    return this.obtenerDeFundacion(id, fundacionId);
  }

  // ---- Piezas de la aprobación (transacción del orquestador) ---------------------------------

  /** Paso 2 de la aprobación: 409 si ya no está pendiente (lanzar revierte la transacción). */
  async aprobar(
    id: number,
    fundacionId: number,
    observacion: string | null,
    manager: EntityManager,
  ): Promise<SolicitudDecidida> {
    const decidida = await this.repo.decidir(
      id,
      fundacionId,
      EstadoSolicitud.Aprobada,
      observacion,
      manager,
    );
    if (!decidida) return this.explicarRechazo(id, fundacionId, manager);
    return decidida;
  }

  /** Paso 5 de la aprobación: devuelve las rechazadas para emitir sus eventos tras el commit. */
  rechazarPendientesDeMascota(
    mascotaId: number,
    manager: EntityManager,
  ): Promise<SolicitudDecidida[]> {
    return this.repo.rechazarPendientesDeMascota(mascotaId, OBSERVACION_AUTOMATICA, manager);
  }

  // ---- Internos ----------------------------------------------------------------------------

  private async obtenerDeAdoptante(
    adoptanteId: number,
    id: number,
  ): Promise<SolicitudDetalleAdoptante> {
    const solicitud = await this.repo.obtenerDeAdoptante(id, adoptanteId);
    if (!solicitud) throw new NotFoundException(MENSAJE_SOLICITUD_NO_EXISTE);
    return solicitud;
  }

  private async adoptanteIdDe(usuarioId: number): Promise<number> {
    const adoptante = await this.usuarios.adoptantePorUsuarioId(usuarioId);
    if (!adoptante) throw new ForbiddenException('Esta acción es exclusiva de adoptantes');
    return adoptante.id;
  }

  /** UPDATE sin filas: 404 si no existe o es ajena (uniforme); 409 si ya no está pendiente. */
  private async explicarRechazo(
    id: number,
    fundacionId: number,
    manager?: EntityManager,
  ): Promise<never> {
    const estado = await this.repo.buscarEstadoDeFundacion(id, fundacionId, manager);
    if (!estado) throw new NotFoundException(MENSAJE_SOLICITUD_NO_EXISTE);
    throw new ConflictException(`La solicitud ya está ${estado}`);
  }

  /** Un fallo al limpiar se registra y nunca oculta el error original. */
  private async eliminarArchivo(clave: string): Promise<void> {
    try {
      await this.storage.eliminar(clave);
    } catch (error) {
      this.logger.warn(
        `No se pudo eliminar el archivo ${clave}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

function esViolacionDePendiente(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const { code, constraint } = error.driverError as { code?: string; constraint?: string };
  return code === '23505' && constraint === CONSTRAINT_PENDIENTE;
}
