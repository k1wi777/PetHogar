import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Fundacion } from './entities/fundacion.entity';
import type { EstadoValidacion } from './entities/fundacion.enum';
import type { DatosNuevaFundacion } from './fundaciones.types';

@Injectable()
export class FundacionesRepository {
  constructor(@InjectRepository(Fundacion) private readonly fundaciones: Repository<Fundacion>) {}

  crear(datos: DatosNuevaFundacion, manager?: EntityManager): Promise<Fundacion> {
    const repo = manager?.getRepository(Fundacion) ?? this.fundaciones;
    return repo.save(
      repo.create({
        usuarioId: datos.usuarioId,
        nombre: datos.nombre,
        nit: datos.nit,
        direccion: datos.direccion,
        ciudad: datos.ciudad,
        descripcion: datos.descripcion,
        documentoUrl: datos.documentoClave,
      }),
    );
  }

  existeNit(nit: string): Promise<boolean> {
    return this.fundaciones.exists({ where: { nit } });
  }

  buscarPorUsuarioId(usuarioId: number): Promise<Fundacion | null> {
    return this.fundaciones.findOne({ where: { usuarioId } });
  }

  buscarPorUsuarioIds(usuarioIds: number[]): Promise<Fundacion[]> {
    return this.fundaciones.find({
      where: { usuarioId: In(usuarioIds) },
      select: { id: true, usuarioId: true, nombre: true },
    });
  }

  buscarPorId(id: number): Promise<Fundacion | null> {
    return this.fundaciones.findOne({ where: { id } });
  }

  /** Orden por `id` ascendente: la más antigua primero y paginación estable. */
  listarPorEstado(
    estado: EstadoValidacion,
    skip: number,
    take: number,
  ): Promise<[Fundacion[], number]> {
    return this.fundaciones.findAndCount({
      where: { estadoValidacion: estado },
      order: { id: 'ASC' },
      skip,
      take,
    });
  }

  /**
   * Una sola sentencia condicionada al estado vigente: de dos decisiones simultáneas solo la que
   * cumple una transición válida sobre el estado actual modifica la fila.
   */
  async decidirValidacion(
    id: number,
    destino: EstadoValidacion,
    origenes: readonly EstadoValidacion[],
    observacion: string | null,
    fecha: Date,
  ): Promise<boolean> {
    const resultado = await this.fundaciones
      .createQueryBuilder()
      .update(Fundacion)
      .set({
        estadoValidacion: destino,
        observacionValidacion: observacion,
        fechaValidacion: fecha,
      })
      .where('id = :id AND "estado_validacion" IN (:...origenes)', { id, origenes })
      .execute();
    return (resultado.affected ?? 0) > 0;
  }
}
