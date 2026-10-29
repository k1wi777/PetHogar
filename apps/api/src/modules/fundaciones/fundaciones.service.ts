import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { EstadoValidacion } from './entities/fundacion.enum';
import type { Fundacion } from './entities/fundacion.entity';
import { FundacionesRepository } from './fundaciones.repository';
import type { DatosNuevaFundacion, EstadoFundacion, FundacionResumen } from './fundaciones.types';

/** Dueño de `fundacion`. Devuelve objetos de dominio, nunca entidades. */
@Injectable()
export class FundacionesService {
  constructor(private readonly repo: FundacionesRepository) {}

  /** Toda fundación nace en `pendiente`, a la espera de la validación del administrador. */
  async crear(datos: DatosNuevaFundacion, manager?: EntityManager): Promise<FundacionResumen> {
    return aResumen(await this.repo.crear(datos, manager));
  }

  existeNit(nit: string): Promise<boolean> {
    return this.repo.existeNit(nit);
  }

  async obtenerPorUsuarioId(usuarioId: number): Promise<FundacionResumen | null> {
    const fundacion = await this.repo.buscarPorUsuarioId(usuarioId);
    return fundacion ? aResumen(fundacion) : null;
  }

  async estadoPorUsuarioId(usuarioId: number): Promise<EstadoFundacion | null> {
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
