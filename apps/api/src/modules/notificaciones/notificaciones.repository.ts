import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notificacion } from './entities/notificacion.entity';
import type { FilaNotificacion } from './notificaciones.mapeo';
import type { FiltroNotificaciones } from './notificaciones.types';

interface DatosInsercion {
  usuarioId: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  entidad: string | null;
  entidadId: number | null;
  clave: string | null;
}

const COLUMNAS = `"id", "tipo", "titulo", "mensaje", "leida", "fecha_creacion" AS "fechaCreacion",
  "entidad", "entidad_id" AS "entidadId"`;

/**
 * El `UPDATE … RETURNING` por SQL directo entrega `[filas, cantidad]` en el driver de Postgres:
 * se normaliza aquí.
 */
function filasDe<T>(crudo: unknown): T[] {
  if (Array.isArray(crudo) && crudo.length === 2 && Array.isArray(crudo[0])) {
    return crudo[0] as T[];
  }
  return crudo as T[];
}

/** Toda lectura y escritura lleva `usuario_id` en la misma sentencia: lo ajeno no existe. */
@Injectable()
export class NotificacionesRepository {
  constructor(
    @InjectRepository(Notificacion) private readonly notificaciones: Repository<Notificacion>,
  ) {}

  /**
   * Atómico: si ya existe una notificación con la misma clave para el destinatario no inserta
   * nada y devuelve `false` (sin consulta previa ni carrera).
   */
  async insertar(datos: DatosInsercion): Promise<boolean> {
    const crudo: unknown = await this.notificaciones.query(
      `INSERT INTO "notificacion" ("usuario_id", "tipo", "titulo", "mensaje", "entidad", "entidad_id", "clave")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT ("usuario_id", "clave") WHERE "clave" IS NOT NULL DO NOTHING
       RETURNING "id"`,
      [
        datos.usuarioId,
        datos.tipo,
        datos.titulo,
        datos.mensaje,
        datos.entidad,
        datos.entidadId,
        datos.clave,
      ],
    );
    return filasDe<{ id: number }>(crudo).length > 0;
  }

  /** Orden estable: más reciente primero y desempate por `id`. */
  async listar(
    usuarioId: number,
    filtro: FiltroNotificaciones,
    skip: number,
    take: number,
  ): Promise<[FilaNotificacion[], number]> {
    const condiciones = filtro.leida === undefined ? '' : ' AND "leida" = $2';
    const parametros: unknown[] =
      filtro.leida === undefined ? [usuarioId] : [usuarioId, filtro.leida];
    const filas: FilaNotificacion[] = await this.notificaciones.query(
      `SELECT ${COLUMNAS} FROM "notificacion" WHERE "usuario_id" = $1${condiciones}
        ORDER BY "fecha_creacion" DESC, "id" DESC
        LIMIT ${Number(take)} OFFSET ${Number(skip)}`,
      parametros,
    );
    const [{ total }]: { total: number }[] = await this.notificaciones.query(
      `SELECT COUNT(*)::int AS "total" FROM "notificacion" WHERE "usuario_id" = $1${condiciones}`,
      parametros,
    );
    return [filas, total];
  }

  async contarNoLeidas(usuarioId: number): Promise<number> {
    const [{ total }]: { total: number }[] = await this.notificaciones.query(
      `SELECT COUNT(*)::int AS "total" FROM "notificacion" WHERE "usuario_id" = $1 AND "leida" = false`,
      [usuarioId],
    );
    return total;
  }

  /** Idempotente: una ya leída también coincide y se devuelve. `null` si es ajena o no existe. */
  async marcarLeida(id: number, usuarioId: number): Promise<FilaNotificacion | null> {
    const crudo: unknown = await this.notificaciones.query(
      `UPDATE "notificacion" SET "leida" = true
        WHERE "id" = $1 AND "usuario_id" = $2
        RETURNING ${COLUMNAS}`,
      [id, usuarioId],
    );
    return filasDe<FilaNotificacion>(crudo)[0] ?? null;
  }

  /** Una sola sentencia: cambia solo las no leídas del usuario y cuenta lo que cambió. */
  async marcarTodas(usuarioId: number): Promise<number> {
    const resultado = await this.notificaciones
      .createQueryBuilder()
      .update(Notificacion)
      .set({ leida: true })
      .where('"usuario_id" = :usuarioId AND "leida" = false', { usuarioId })
      .execute();
    return resultado.affected ?? 0;
  }
}
