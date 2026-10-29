import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { desplazamiento, type Paginado, paginar } from '../../common/pagination/paginar';
import type { PaginacionQueryDto } from '../../common/pagination/paginacion-query.dto';
import { CatalogosService } from '../catalogos/catalogos.service';
import type { CrearMascotaDto } from './dto/crear-mascota.dto';
import type { EditarMascotaDto } from './dto/editar-mascota.dto';
import type { Mascota } from './entities/mascota.entity';
import { EstadoMascota } from './entities/mascota.enum';
import { EstadoMascotaMaquina, type OrigenCambio } from './estado-mascota.maquina';
import { FotosMascotaService } from './fotos/fotos-mascota.service';
import { MENSAJE_MASCOTA_NO_EXISTE } from './mascotas.mensajes';
import { MascotasRepository } from './mascotas.repository';
import type {
  CambiosMascota,
  FiltroMascotasFundacion,
  MascotaGestion,
  MascotaGestionDetalle,
  MascotaParaSolicitud,
} from './mascotas.types';

const MENSAJE_SOLICITUD_NO_EXISTE = 'La solicitud no existe';
const MENSAJE_RAZA_NO_EXISTE = 'La raza no existe';

const ETIQUETA_ESTADO: Record<EstadoMascota, string> = {
  [EstadoMascota.Disponible]: 'disponible',
  [EstadoMascota.EnProceso]: 'en proceso de adopción',
  [EstadoMascota.Adoptada]: 'adoptada',
  [EstadoMascota.Inactiva]: 'inactiva',
};

export interface OpcionesTransicion {
  /** Si se indica, la mascota debe ser de esa fundación (404 si no). */
  fundacionId?: number;
  manager?: EntityManager;
}

/** Dueño de `mascota`: alta, edición, baja y listado propio. Devuelve objetos de dominio. */
@Injectable()
export class MascotasService {
  constructor(
    private readonly repo: MascotasRepository,
    private readonly catalogos: CatalogosService,
    private readonly fotos: FotosMascotaService,
  ) {}

  /** `fundacionId` sale del guard, nunca del cuerpo; el estado inicial lo fija la columna. */
  async crear(fundacionId: number, dto: CrearMascotaDto): Promise<MascotaGestion> {
    await this.exigirRaza(dto.razaId);
    const mascota = await this.repo.crear(fundacionId, {
      razaId: dto.razaId,
      nombre: dto.nombre,
      sexo: dto.sexo,
      edadMeses: dto.edadMeses,
      tamano: dto.tamano,
      color: dto.color ?? null,
      esterilizado: dto.esterilizado ?? false,
      vacunado: dto.vacunado ?? false,
      estadoSalud: dto.estadoSalud,
      descripcion: dto.descripcion ?? null,
    });
    return aGestion(mascota);
  }

  async editar(id: number, fundacionId: number, dto: EditarMascotaDto): Promise<MascotaGestion> {
    const cambios = cambiosDe(dto);
    if (Object.keys(cambios).length === 0) {
      throw new BadRequestException('Indica al menos un dato para actualizar');
    }
    if (cambios.razaId !== undefined) await this.exigirRaza(cambios.razaId);
    const aplicada = await this.repo.editar(
      id,
      fundacionId,
      EstadoMascotaMaquina.estadosEditables(),
      cambios,
    );
    if (!aplicada) await this.explicarRechazo(id, fundacionId);
    return this.obtenerDeFundacion(id, fundacionId);
  }

  /** La fundación solo puede dar de baja una mascota disponible. */
  async darDeBaja(id: number, fundacionId: number): Promise<MascotaGestion> {
    await this.transicionar(id, EstadoMascota.Inactiva, 'fundacion', { fundacionId });
    return this.obtenerDeFundacion(id, fundacionId);
  }

  /**
   * Cambio de estado atómico (UPDATE condicionado al estado vigente). Exportado para adopciones,
   * que lo llama con `origen = 'adopcion'` y su propio `manager`.
   */
  async transicionar(
    id: number,
    hasta: EstadoMascota,
    origen: OrigenCambio,
    opciones: OpcionesTransicion = {},
  ): Promise<void> {
    const desde = EstadoMascotaMaquina.origenesPara(hasta, origen);
    const aplicada =
      desde.length > 0 &&
      (await this.repo.cambiarEstado(id, desde, hasta, opciones.fundacionId, opciones.manager));
    if (!aplicada) await this.explicarRechazo(id, opciones.fundacionId);
  }

  /** Para crear una solicitud: 404 si la mascota no existe. El estado lo valida el llamador. */
  async obtenerParaSolicitud(id: number): Promise<MascotaParaSolicitud> {
    const mascota = await this.repo.buscarParaSolicitud(id);
    if (!mascota) throw new NotFoundException(MENSAJE_MASCOTA_NO_EXISTE);
    return mascota;
  }

  /**
   * Bloquea la mascota de una solicitud dentro de la transacción de quien decide
   * (404 si la solicitud no es de una mascota de la fundación).
   */
  async bloquearParaDecision(
    manager: EntityManager,
    solicitudId: number,
    fundacionId: number,
  ): Promise<number> {
    const fila = await this.repo.bloquearParaDecision(manager, solicitudId, fundacionId);
    if (!fila) throw new NotFoundException(MENSAJE_SOLICITUD_NO_EXISTE);
    return fila.id;
  }

  async listarDeFundacion(
    fundacionId: number,
    filtro: FiltroMascotasFundacion,
    paginacion: PaginacionQueryDto,
  ): Promise<Paginado<MascotaGestion>> {
    const { skip, take } = desplazamiento(paginacion);
    const [filas, total] = await this.repo.listarDeFundacion(fundacionId, filtro, skip, take);
    return paginar(filas.map(aGestion), total, paginacion);
  }

  async obtenerDeFundacion(id: number, fundacionId: number): Promise<MascotaGestion> {
    const mascota = await this.repo.buscarDeFundacion(id, fundacionId);
    if (!mascota) throw new NotFoundException(MENSAJE_MASCOTA_NO_EXISTE);
    return aGestion(mascota);
  }

  /** Detalle del dueño en cualquier estado, con su galería (el gestor de fotos lo necesita). */
  async obtenerDetalleDeFundacion(id: number, fundacionId: number): Promise<MascotaGestionDetalle> {
    const mascota = await this.obtenerDeFundacion(id, fundacionId);
    return { ...mascota, fotos: await this.fotos.listar(id) };
  }

  private async exigirRaza(razaId: number): Promise<void> {
    if (!(await this.catalogos.existeRaza(razaId))) {
      throw new BadRequestException({
        message: 'Los datos enviados no son válidos',
        errores: [{ campo: 'razaId', mensajes: [MENSAJE_RAZA_NO_EXISTE] }],
      });
    }
  }

  /** Un UPDATE sin filas: 404 si no existe o no es de la fundación; 409 si el estado no lo admite. */
  private async explicarRechazo(id: number, fundacionId?: number): Promise<never> {
    const estado =
      fundacionId === undefined
        ? await this.repo.buscarEstado(id)
        : ((await this.repo.buscarDeFundacion(id, fundacionId))?.estado ?? null);
    if (!estado) throw new NotFoundException(MENSAJE_MASCOTA_NO_EXISTE);
    throw new ConflictException(
      `La mascota está ${ETIQUETA_ESTADO[estado]} y no admite esta acción`,
    );
  }
}

function cambiosDe(dto: EditarMascotaDto): CambiosMascota {
  const candidatos: CambiosMascota = {
    razaId: dto.razaId,
    nombre: dto.nombre,
    sexo: dto.sexo,
    edadMeses: dto.edadMeses,
    tamano: dto.tamano,
    color: dto.color,
    esterilizado: dto.esterilizado,
    vacunado: dto.vacunado,
    estadoSalud: dto.estadoSalud,
    descripcion: dto.descripcion,
  };
  return Object.fromEntries(
    Object.entries(candidatos).filter(([, valor]) => valor !== undefined),
  ) as CambiosMascota;
}

function aGestion(m: Mascota): MascotaGestion {
  return {
    id: m.id,
    razaId: m.razaId,
    nombre: m.nombre,
    sexo: m.sexo,
    edadMeses: m.edadMeses,
    tamano: m.tamano,
    color: m.color,
    esterilizado: m.esterilizado,
    vacunado: m.vacunado,
    estadoSalud: m.estadoSalud,
    descripcion: m.descripcion,
    estado: m.estado,
    fechaPublicacion: m.fechaPublicacion,
  };
}
