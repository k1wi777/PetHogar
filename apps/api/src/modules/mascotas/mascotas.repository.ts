import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Mascota } from './entities/mascota.entity';
import type { EstadoMascota } from './entities/mascota.enum';
import type { CambiosMascota, DatosMascota, FiltroMascotasFundacion } from './mascotas.types';

/**
 * Dueño de `mascota` (escritura y lecturas de la fundación dueña). Toda operación del dueño
 * filtra por `fundacion_id` en la misma sentencia: una mascota ajena es indistinguible de una
 * inexistente.
 */
@Injectable()
export class MascotasRepository {
  constructor(@InjectRepository(Mascota) private readonly mascotas: Repository<Mascota>) {}

  /** `estado` y `fechaPublicacion` los asigna la base de datos (disponible y ahora). */
  crear(fundacionId: number, datos: DatosMascota): Promise<Mascota> {
    return this.mascotas.save(this.mascotas.create({ ...datos, fundacionId }));
  }

  buscarDeFundacion(id: number, fundacionId: number): Promise<Mascota | null> {
    return this.mascotas.findOne({ where: { id, fundacionId } });
  }

  /** Lectura sin filtro de propiedad: solo para distinguir 404 de 409 tras un UPDATE sin filas. */
  buscarEstado(id: number): Promise<EstadoMascota | null> {
    return this.mascotas
      .findOne({ where: { id }, select: { id: true, estado: true } })
      .then((m) => m?.estado ?? null);
  }

  listarDeFundacion(
    fundacionId: number,
    filtro: FiltroMascotasFundacion,
    skip: number,
    take: number,
  ): Promise<[Mascota[], number]> {
    return this.mascotas.findAndCount({
      where: { fundacionId, ...(filtro.estado ? { estado: filtro.estado } : {}) },
      order: { fechaPublicacion: 'DESC', id: 'DESC' },
      skip,
      take,
    });
  }

  /**
   * UPDATE condicionado al estado vigente: de dos cambios simultáneos solo gana el que parte del
   * estado actual. `fundacionId` (si se indica) añade la propiedad a la misma sentencia.
   */
  async cambiarEstado(
    id: number,
    desde: readonly EstadoMascota[],
    hasta: EstadoMascota,
    fundacionId?: number,
    manager?: EntityManager,
  ): Promise<boolean> {
    const repo = manager?.getRepository(Mascota) ?? this.mascotas;
    const consulta = repo
      .createQueryBuilder()
      .update(Mascota)
      .set({ estado: hasta })
      .where('"id" = :id AND "estado" IN (:...desde)', { id, desde });
    if (fundacionId !== undefined)
      consulta.andWhere('"fundacion_id" = :fundacionId', { fundacionId });
    const resultado = await consulta.execute();
    return (resultado.affected ?? 0) > 0;
  }

  /** Edita solo si la mascota es de la fundación y está en uno de los estados editables. */
  async editar(
    id: number,
    fundacionId: number,
    editables: readonly EstadoMascota[],
    cambios: CambiosMascota,
  ): Promise<boolean> {
    const resultado = await this.mascotas
      .createQueryBuilder()
      .update(Mascota)
      .set(cambios)
      .where('"id" = :id AND "fundacion_id" = :fundacionId AND "estado" IN (:...editables)', {
        id,
        fundacionId,
        editables,
      })
      .execute();
    return (resultado.affected ?? 0) > 0;
  }

  /**
   * Bloquea la fila de una mascota de la fundación hasta el fin de la transacción: serializa las
   * operaciones sobre sus fotos (el límite de 6 no puede depender de lecturas concurrentes).
   */
  async bloquearDeFundacion(
    manager: EntityManager,
    id: number,
    fundacionId: number,
  ): Promise<boolean> {
    const filas: { id: number }[] = await manager.query(
      'SELECT "id" FROM "mascota" WHERE "id" = $1 AND "fundacion_id" = $2 FOR UPDATE',
      [id, fundacionId],
    );
    return filas.length > 0;
  }
}
