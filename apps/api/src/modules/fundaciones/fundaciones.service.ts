import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { EstadoValidacion } from './entities/fundacion.enum';
import type { Fundacion } from './entities/fundacion.entity';
import { desplazamiento, type Paginado, paginar } from '../../common/pagination/paginar';
import type { PaginacionQueryDto } from '../../common/pagination/paginacion-query.dto';
import { FundacionesRepository } from './fundaciones.repository';
import {
  type DatosNuevaFundacion,
  type DecisionValidacion,
  type FundacionAdminDetalle,
  type FundacionAdminResumen,
  type FundacionBasica,
  type FundacionResumen,
  TRANSICIONES,
} from './fundaciones.types';

const MENSAJE_NO_ENCONTRADA = 'La fundación no existe';

/** Dueño de `fundacion`. Devuelve objetos de dominio, nunca entidades. */
@Injectable()
export class FundacionesService {
  constructor(private readonly repo: FundacionesRepository) {}

  /** Toda fundación nace en `pendiente`, a la espera de la validación del administrador. */
  async crear(datos: DatosNuevaFundacion, manager?: EntityManager): Promise<FundacionResumen> {
    return aResumen(await this.repo.crear(datos, manager));
  }

  /** Para donaciones y avisos; `null` si no existe. No expone documento ni observaciones. */
  async datosBasicos(id: number): Promise<FundacionBasica | null> {
    const f = await this.repo.buscarPorId(id);
    return (
      f && {
        id: f.id,
        nombre: f.nombre,
        usuarioId: f.usuarioId,
        estadoValidacion: f.estadoValidacion,
      }
    );
  }

  /** Nombre de las fundaciones cuyo usuario está en `usuarioIds` (clave: id de usuario). */
  async nombresPorUsuarioIds(usuarioIds: number[]): Promise<Map<number, string>> {
    if (usuarioIds.length === 0) return new Map();
    const filas = await this.repo.buscarPorUsuarioIds(usuarioIds);
    return new Map(filas.map((f) => [f.usuarioId, f.nombre]));
  }

  existeNit(nit: string): Promise<boolean> {
    return this.repo.existeNit(nit);
  }

  async obtenerPorUsuarioId(usuarioId: number): Promise<FundacionResumen | null> {
    const fundacion = await this.repo.buscarPorUsuarioId(usuarioId);
    return fundacion ? aResumen(fundacion) : null;
  }

  async listarPorEstado(
    estado: EstadoValidacion,
    paginacion: PaginacionQueryDto,
  ): Promise<Paginado<FundacionAdminResumen>> {
    const { skip, take } = desplazamiento(paginacion);
    const [filas, total] = await this.repo.listarPorEstado(estado, skip, take);
    return paginar(filas.map(aAdminResumen), total, paginacion);
  }

  async obtenerDetalle(id: number): Promise<FundacionAdminDetalle> {
    const fundacion = await this.repo.buscarPorId(id);
    if (!fundacion) throw new NotFoundException(MENSAJE_NO_ENCONTRADA);
    return aAdminDetalle(fundacion);
  }

  /** Interna: la clave de almacenamiento solo viaja hacia `IStorageService`, nunca a una respuesta. */
  async obtenerClaveDocumento(id: number): Promise<string> {
    const fundacion = await this.repo.buscarPorId(id);
    if (!fundacion) throw new NotFoundException(MENSAJE_NO_ENCONTRADA);
    return fundacion.documentoUrl;
  }

  /**
   * Aplica la decisión solo si es una transición válida sobre el estado vigente (404 si la
   * fundación no existe, 409 si la transición no está permitida). Devuelve la fundación actualizada.
   */
  async decidirValidacion(
    id: number,
    decision: DecisionValidacion,
    observacion: string | null,
    ahora: Date = new Date(),
  ): Promise<FundacionAdminDetalle> {
    const aplicada = await this.repo.decidirValidacion(
      id,
      decision,
      TRANSICIONES[decision],
      observacion,
      ahora,
    );
    if (!aplicada) {
      const actual = await this.repo.buscarPorId(id);
      if (!actual) throw new NotFoundException(MENSAJE_NO_ENCONTRADA);
      throw new ConflictException(
        actual.estadoValidacion === decision
          ? `La fundación ya está en estado «${decision}»`
          : `No se puede cambiar una fundación de «${actual.estadoValidacion}» a «${decision}»`,
      );
    }
    return this.obtenerDetalle(id);
  }

  async estadoPorUsuarioId(usuarioId: number): Promise<FundacionResumen | null> {
    return this.obtenerPorUsuarioId(usuarioId);
  }
}

function aResumen(fundacion: Fundacion): FundacionResumen {
  const rechazada = fundacion.estadoValidacion === EstadoValidacion.Rechazada;
  return {
    id: fundacion.id,
    nombre: fundacion.nombre,
    estadoValidacion: fundacion.estadoValidacion,
    observacionValidacion: rechazada ? fundacion.observacionValidacion : null,
  };
}

function aAdminResumen(fundacion: Fundacion): FundacionAdminResumen {
  return {
    id: fundacion.id,
    nombre: fundacion.nombre,
    nit: fundacion.nit,
    ciudad: fundacion.ciudad,
    estadoValidacion: fundacion.estadoValidacion,
    fechaValidacion: fundacion.fechaValidacion,
  };
}

function aAdminDetalle(fundacion: Fundacion): FundacionAdminDetalle {
  return {
    ...aAdminResumen(fundacion),
    usuarioId: fundacion.usuarioId,
    direccion: fundacion.direccion,
    descripcion: fundacion.descripcion,
    observacionValidacion: fundacion.observacionValidacion,
  };
}
