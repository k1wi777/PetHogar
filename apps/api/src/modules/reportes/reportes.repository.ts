import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { clausulaDeDonaciones } from '../donaciones/donaciones.repository';
import type { TipoDonacion } from '../donaciones/entities/donacion.enum';
import type { EstadoSolicitud } from '../solicitudes/entities/solicitud-adopcion.enum';
import type { EstadoSeguimiento } from '../seguimientos/entities/seguimiento.enum';
import type {
  FilaPorBienestar,
  FilaPorEspecie,
  FilaPorEstado,
  FilaPorMes,
  FilaPorMesConMonto,
  FilaDonacionPdf,
  FilaPorTipo,
  FilaSeguimientoPdf,
  FilaSolicitudPdf,
  FiltroReporte,
} from './reportes.types';

type TipoFecha = 'date' | 'timestamptz';

interface Clausula {
  where: string;
  parametros: unknown[];
}

const MES_BOGOTA = (columna: string): string =>
  `to_char(${columna} AT TIME ZONE 'America/Bogota', 'YYYY-MM')`;

/**
 * `WHERE` común de todas las consultas: la propiedad (`fundacion_id`) y el rango de fechas van en
 * la misma sentencia. Con `fundacionId` ausente (administrador global) no se filtra por fundación.
 */
export function clausulaDeReporte(
  filtro: FiltroReporte,
  columnaFundacion: string,
  columnaFecha: string,
  tipoFecha: TipoFecha,
): Clausula {
  const condiciones: string[] = [];
  const parametros: unknown[] = [];
  const agregar = (sql: (n: number) => string, valor: unknown): void => {
    parametros.push(valor);
    condiciones.push(sql(parametros.length));
  };
  if (filtro.fundacionId !== undefined) {
    agregar((n) => `${columnaFundacion} = $${n}`, filtro.fundacionId);
  }
  if (tipoFecha === 'date') {
    if (filtro.desde) agregar((n) => `${columnaFecha} >= $${n}::date`, filtro.desde);
    if (filtro.hasta) agregar((n) => `${columnaFecha} <= $${n}::date`, filtro.hasta);
  } else {
    if (filtro.desdeInstante) {
      agregar((n) => `${columnaFecha} >= $${n}::timestamptz`, filtro.desdeInstante.toISOString());
    }
    if (filtro.hastaExclusivo) {
      agregar((n) => `${columnaFecha} < $${n}::timestamptz`, filtro.hastaExclusivo.toISOString());
    }
  }
  return { where: condiciones.length > 0 ? condiciones.join(' AND ') : 'TRUE', parametros };
}

export const UNION_ADOPCION = `FROM "adopcion" a
    JOIN "solicitud_adopcion" s ON s."id" = a."solicitud_id"
    JOIN "mascota" m ON m."id" = s."mascota_id"`;

export const UNION_SEGUIMIENTO = `FROM "seguimiento" sg
    JOIN "adopcion" a ON a."id" = sg."adopcion_id"
    JOIN "solicitud_adopcion" s ON s."id" = a."solicitud_id"
    JOIN "mascota" m ON m."id" = s."mascota_id"`;

/**
 * Lecturas agregadas de solo lectura sobre tablas de otros módulos (cuarta excepción acotada de
 * `architecture.md`): columnas concretas, sin datos personales y siempre con el `EntityManager` de
 * la instantánea, de modo que todas las cifras salen del mismo snapshot.
 */
@Injectable()
export class ReportesRepository {
  async existeFundacion(id: number, manager: EntityManager): Promise<boolean> {
    const filas: unknown[] = await manager.query(`SELECT 1 FROM "fundacion" WHERE "id" = $1`, [id]);
    return filas.length > 0;
  }

  adopcionesPorMes(filtro: FiltroReporte, manager: EntityManager): Promise<FilaPorMes[]> {
    const { where, parametros } = clausulaDeReporte(
      filtro,
      'm."fundacion_id"',
      'a."fecha_entrega"',
      'date',
    );
    return manager.query(
      `SELECT to_char(a."fecha_entrega", 'YYYY-MM') AS "mes", COUNT(*)::int AS "cantidad"
         ${UNION_ADOPCION} WHERE ${where} GROUP BY 1 ORDER BY 1`,
      parametros,
    );
  }

  adopcionesPorEspecie(filtro: FiltroReporte, manager: EntityManager): Promise<FilaPorEspecie[]> {
    const { where, parametros } = clausulaDeReporte(
      filtro,
      'm."fundacion_id"',
      'a."fecha_entrega"',
      'date',
    );
    return manager.query(
      `SELECT e."nombre" AS "especie", COUNT(*)::int AS "cantidad"
         ${UNION_ADOPCION}
         JOIN "raza" r ON r."id" = m."raza_id"
         JOIN "especie" e ON e."id" = r."especie_id"
        WHERE ${where} GROUP BY e."nombre" ORDER BY "cantidad" DESC, e."nombre"`,
      parametros,
    );
  }

  solicitudesPorEstado(
    filtro: FiltroReporte,
    manager: EntityManager,
  ): Promise<FilaPorEstado<EstadoSolicitud>[]> {
    const { where, parametros } = clausulaDeReporte(
      filtro,
      'm."fundacion_id"',
      's."fecha_solicitud"',
      'timestamptz',
    );
    return manager.query(
      `SELECT s."estado"::text AS "estado", COUNT(*)::int AS "cantidad"
         FROM "solicitud_adopcion" s JOIN "mascota" m ON m."id" = s."mascota_id"
        WHERE ${where} GROUP BY s."estado"`,
      parametros,
    );
  }

  /**
   * `vencido` se calcula como en los listados del módulo: por estado o por un `programado` con
   * fecha anterior a `hoy`, sin esperar a la tarea diaria.
   */
  seguimientosPorEstado(
    filtro: FiltroReporte,
    hoy: string,
    manager: EntityManager,
  ): Promise<FilaPorEstado<EstadoSeguimiento>[]> {
    const { where, parametros } = clausulaDeReporte(
      filtro,
      'm."fundacion_id"',
      'sg."fecha_programada"',
      'date',
    );
    parametros.push(hoy);
    return manager.query(
      `SELECT CASE WHEN sg."estado" = 'programado' AND sg."fecha_programada" < $${parametros.length}::date
                   THEN 'vencido' ELSE sg."estado"::text END AS "estado",
              COUNT(*)::int AS "cantidad"
         ${UNION_SEGUIMIENTO} WHERE ${where} GROUP BY 1`,
      parametros,
    );
  }

  seguimientosPorBienestar(
    filtro: FiltroReporte,
    manager: EntityManager,
  ): Promise<FilaPorBienestar[]> {
    const { where, parametros } = clausulaDeReporte(
      filtro,
      'm."fundacion_id"',
      'sg."fecha_programada"',
      'date',
    );
    return manager.query(
      `SELECT sg."estado_bienestar"::text AS "bienestar", COUNT(*)::int AS "cantidad"
         ${UNION_SEGUIMIENTO}
        WHERE ${where} AND sg."estado_bienestar" IS NOT NULL GROUP BY 1`,
      parametros,
    );
  }

  donacionesPorMes(filtro: FiltroReporte, manager: EntityManager): Promise<FilaPorMesConMonto[]> {
    const { where, parametros } = clausulaDeReporte(
      filtro,
      'd."fundacion_id"',
      'd."fecha"',
      'timestamptz',
    );
    return manager.query(
      `SELECT ${MES_BOGOTA('d."fecha"')} AS "mes", COUNT(*)::int AS "cantidad",
              COALESCE(SUM(d."monto"), 0.00)::text AS "monto"
         FROM "donacion" d WHERE ${where} GROUP BY 1 ORDER BY 1`,
      parametros,
    );
  }

  donacionesPorTipo(filtro: FiltroReporte, manager: EntityManager): Promise<FilaPorTipo[]> {
    const { where, parametros } = clausulaDeReporte(
      filtro,
      'd."fundacion_id"',
      'd."fecha"',
      'timestamptz',
    );
    return manager.query(
      `SELECT d."tipo"::text AS "tipo", COUNT(*)::int AS "cantidad",
              COALESCE(SUM(d."monto"), 0.00)::text AS "monto"
         FROM "donacion" d WHERE ${where} GROUP BY d."tipo"`,
      parametros,
    );
  }

  /** Más reciente primero, con tope de filas. */
  listarSolicitudes(
    filtro: FiltroReporte,
    estado: EstadoSolicitud | undefined,
    limite: number,
    manager: EntityManager,
  ): Promise<FilaSolicitudPdf[]> {
    const { where, parametros } = clausulaSolicitudes(filtro, estado);
    return manager.query(
      `SELECT to_char(s."fecha_solicitud" AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS "fecha",
              m."nombre" AS "mascota",
              concat_ws(' ', a."primer_nombre", a."segundo_nombre", a."primer_apellido", a."segundo_apellido") AS "adoptante",
              a."ciudad" AS "ciudad", s."estado"::text AS "estado", s."observacion" AS "observacion"
         FROM "solicitud_adopcion" s
         JOIN "mascota" m ON m."id" = s."mascota_id"
         JOIN "adoptante" a ON a."id" = s."adoptante_id"
        WHERE ${where}
        ORDER BY s."fecha_solicitud" DESC, s."id" DESC LIMIT ${Number(limite)}`,
      parametros,
    );
  }

  async contarSolicitudes(
    filtro: FiltroReporte,
    estado: EstadoSolicitud | undefined,
    manager: EntityManager,
  ): Promise<number> {
    const { where, parametros } = clausulaSolicitudes(filtro, estado);
    const filas: { total: number }[] = await manager.query(
      `SELECT COUNT(*)::int AS "total" FROM "solicitud_adopcion" s
         JOIN "mascota" m ON m."id" = s."mascota_id" WHERE ${where}`,
      parametros,
    );
    return filas[0].total;
  }

  listarSeguimientos(
    filtro: FiltroReporte,
    estado: EstadoSeguimiento | undefined,
    hoy: string,
    limite: number,
    manager: EntityManager,
  ): Promise<FilaSeguimientoPdf[]> {
    const { where, parametros, posicionHoy } = clausulaSeguimientos(filtro, estado, hoy, true);
    return manager.query(
      `SELECT to_char(sg."fecha_programada", 'YYYY-MM-DD') AS "fecha", m."nombre" AS "mascota",
              sg."tipo"::text AS "tipo", ${ESTADO_EFECTIVO(posicionHoy)} AS "estado",
              sg."estado_bienestar"::text AS "bienestar", sg."observaciones" AS "observaciones"
         ${UNION_SEGUIMIENTO}
        WHERE ${where}
        ORDER BY sg."fecha_programada" DESC, sg."id" DESC LIMIT ${Number(limite)}`,
      parametros,
    );
  }

  async contarSeguimientos(
    filtro: FiltroReporte,
    estado: EstadoSeguimiento | undefined,
    hoy: string,
    manager: EntityManager,
  ): Promise<number> {
    const { where, parametros } = clausulaSeguimientos(filtro, estado, hoy, false);
    const filas: { total: number }[] = await manager.query(
      `SELECT COUNT(*)::int AS "total" ${UNION_SEGUIMIENTO} WHERE ${where}`,
      parametros,
    );
    return filas[0].total;
  }

  /**
   * Misma cláusula (`clausulaDeDonaciones`) que `GET /fundacion/donaciones`. El nombre del donante
   * se resuelve solo con nombres: el registrado a mano, el del adoptante o el de la fundación donante.
   */
  listarDonaciones(
    fundacionId: number,
    filtro: FiltroReporte,
    tipo: TipoDonacion | undefined,
    limite: number,
    manager: EntityManager,
  ): Promise<FilaDonacionPdf[]> {
    const { where, parametros } = clausulaDeDonaciones(
      fundacionId,
      filtroDeDonaciones(filtro, tipo),
    );
    return manager.query(
      `SELECT to_char(d."fecha" AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS "fecha",
              COALESCE(d."nombre_donante",
                       NULLIF(concat_ws(' ', ad."primer_nombre", ad."segundo_nombre", ad."primer_apellido", ad."segundo_apellido"), ''),
                       fd."nombre", 'Donante registrado') AS "donante",
              d."tipo"::text AS "tipo", d."monto"::text AS "monto", d."descripcion_especie" AS "descripcion"
         FROM (SELECT * FROM "donacion" WHERE ${where}
                ORDER BY "fecha" DESC, "id" DESC LIMIT ${Number(limite)}) d
         LEFT JOIN "adoptante" ad ON ad."usuario_id" = d."usuario_id"
         LEFT JOIN "fundacion" fd ON fd."usuario_id" = d."usuario_id"
        ORDER BY d."fecha" DESC, d."id" DESC`,
      parametros,
    );
  }

  /** Total y monto por tipo de TODO el conjunto filtrado (no solo de las filas del tope). */
  totalesDonaciones(
    fundacionId: number,
    filtro: FiltroReporte,
    tipo: TipoDonacion | undefined,
    manager: EntityManager,
  ): Promise<FilaPorTipo[]> {
    const { where, parametros } = clausulaDeDonaciones(
      fundacionId,
      filtroDeDonaciones(filtro, tipo),
    );
    return manager.query(
      `SELECT "tipo"::text AS "tipo", COUNT(*)::int AS "cantidad",
              COALESCE(SUM("monto"), 0.00)::text AS "monto"
         FROM "donacion" WHERE ${where} GROUP BY "tipo"`,
      parametros,
    );
  }
}

function filtroDeDonaciones(filtro: FiltroReporte, tipo: TipoDonacion | undefined) {
  return { desde: filtro.desdeInstante, hastaExclusivo: filtro.hastaExclusivo, tipo };
}

function clausulaSolicitudes(filtro: FiltroReporte, estado: EstadoSolicitud | undefined): Clausula {
  const c = clausulaDeReporte(filtro, 'm."fundacion_id"', 's."fecha_solicitud"', 'timestamptz');
  if (estado) {
    // Sin `::text` en la columna: así el planificador puede usar `idx_solicitud_estado_fecha`.
    c.parametros.push(estado);
    c.where = `${c.where} AND s."estado" = $${c.parametros.length}::solicitud_adopcion_estado_enum`;
  }
  return c;
}

const ESTADO_EFECTIVO = (n: number): string =>
  `CASE WHEN sg."estado" = 'programado' AND sg."fecha_programada" < $${n}::date THEN 'vencido' ELSE sg."estado"::text END`;

function clausulaSeguimientos(
  filtro: FiltroReporte,
  estado: EstadoSeguimiento | undefined,
  hoy: string,
  /** El listado usa `hoy` en el `SELECT`; el conteo solo si filtra por estado (un parámetro sin usar falla en Postgres). */
  hoyEnSelect: boolean,
): Clausula & { posicionHoy: number } {
  const c = clausulaDeReporte(filtro, 'm."fundacion_id"', 'sg."fecha_programada"', 'date');
  let posicionHoy = 0;
  if (hoyEnSelect || estado) {
    c.parametros.push(hoy);
    posicionHoy = c.parametros.length;
  }
  if (estado) {
    c.parametros.push(estado);
    c.where = `${c.where} AND ${ESTADO_EFECTIVO(posicionHoy)} = $${c.parametros.length}`;
  }
  return { ...c, posicionHoy };
}
