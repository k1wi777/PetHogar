import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { FotoMascota } from '../entities/foto-mascota.entity';

export interface ConteoFotos {
  total: number;
  principales: number;
}

export interface FotoBorrada {
  url: string;
  urlCatalogo: string;
  esPrincipal: boolean;
}

/** Dueño de `foto_mascota`. Las operaciones con `manager` se ejecutan en la transacción del llamante. */
@Injectable()
export class FotosMascotaRepository {
  constructor(@InjectRepository(FotoMascota) private readonly fotos: Repository<FotoMascota>) {}

  enTransaccion<T>(trabajo: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.fotos.manager.transaction(trabajo);
  }

  /** Principal primero y luego por id: orden estable de la galería. */
  listar(mascotaId: number): Promise<FotoMascota[]> {
    return this.fotos.find({ where: { mascotaId }, order: { esPrincipal: 'DESC', id: 'ASC' } });
  }

  async contar(mascotaId: number, manager?: EntityManager): Promise<ConteoFotos> {
    const repo = manager?.getRepository(FotoMascota) ?? this.fotos;
    const fila: { total: string; principales: string } | undefined = await repo
      .createQueryBuilder('f')
      .select('count(*)', 'total')
      .addSelect('count(*) FILTER (WHERE f.es_principal)', 'principales')
      .where('f.mascota_id = :mascotaId', { mascotaId })
      .getRawOne();
    return { total: Number(fila?.total ?? 0), principales: Number(fila?.principales ?? 0) };
  }

  insertar(
    manager: EntityManager,
    datos: { mascotaId: number; url: string; urlCatalogo: string; esPrincipal: boolean },
  ): Promise<FotoMascota> {
    const repo = manager.getRepository(FotoMascota);
    return repo.save(repo.create(datos));
  }

  async existe(manager: EntityManager, mascotaId: number, fotoId: number): Promise<boolean> {
    return manager.getRepository(FotoMascota).exists({ where: { id: fotoId, mascotaId } });
  }

  /** Deja todas las fotos de la mascota sin principal y marca la elegida (índice único parcial como red). */
  async marcarPrincipal(manager: EntityManager, mascotaId: number, fotoId: number): Promise<void> {
    const repo = manager.getRepository(FotoMascota);
    await repo.update({ mascotaId, esPrincipal: true }, { esPrincipal: false });
    await repo.update({ id: fotoId, mascotaId }, { esPrincipal: true });
  }

  async eliminar(
    manager: EntityManager,
    mascotaId: number,
    fotoId: number,
  ): Promise<FotoBorrada | null> {
    // En Postgres, TypeORM devuelve `[filas, cantidad]` para un DELETE.
    const [filas]: [{ url: string; url_catalogo: string; es_principal: boolean }[], number] =
      await manager.query(
        `DELETE FROM "foto_mascota" WHERE "id" = $1 AND "mascota_id" = $2
         RETURNING "url", "url_catalogo", "es_principal"`,
        [fotoId, mascotaId],
      );
    const fila = filas[0];
    return fila
      ? { url: fila.url, urlCatalogo: fila.url_catalogo, esPrincipal: fila.es_principal }
      : null;
  }

  /** Promueve la foto de menor id de la mascota (si queda alguna). */
  async promoverMenor(manager: EntityManager, mascotaId: number): Promise<void> {
    await manager.query(
      `UPDATE "foto_mascota" SET "es_principal" = true
       WHERE "id" = (SELECT min("id") FROM "foto_mascota" WHERE "mascota_id" = $1)`,
      [mascotaId],
    );
  }
}
