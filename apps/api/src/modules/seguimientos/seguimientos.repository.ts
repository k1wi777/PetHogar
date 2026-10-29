import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import type { EstadoAdopcion } from '../adopciones/entities/adopcion.enum';
import { EstadoSeguimientoMaquina } from './estado-seguimiento.maquina';
import {
  type EstadoBienestar,
  EstadoSeguimiento,
  OrigenEvidencia,
  type TipoSeguimiento,
} from './entities/seguimiento.enum';
import { SeguimientoEvidencia } from './entities/seguimiento-evidencia.entity';
import { Seguimiento } from './entities/seguimiento.entity';
import { MAX_RESUMEN_POR_ADOPCION } from './seguimientos.constants';
import type {
  AdopcionParaProgramar,
  DatosResultado,
  DuenoSeguimiento,
  FiltroSeguimientos,
  FotoSeguimiento,
  ReporteAdoptante,
  ResumenSeguimiento,
  SeguimientoBase,
  SeguimientoDeTarea,
  SeguimientoDetalleAdoptante,
  SeguimientoDetalleFundacion,
  SeguimientoListaAdoptante,
  SeguimientoListaFundacion,
  SeguimientoParaAccion,
  SeguimientoParaAviso,
} from './seguimientos.types';

interface FilaBase {
  id: number;
  adopcionId: number;
  tipo: TipoSeguimiento;
  fechaProgramada: string;
  fechaRealizada: string | null;
  estado: EstadoSeguimiento;
  vencido: boolean;
  tieneReporte: boolean;
  mascotaId: number;
  mascotaNombre: string;
}
type FilaFundacion = FilaBase & { adoptanteNombre: string };
type FilaAdoptante = FilaBase & { fundacionNombre: string };
interface FilaDetalle {
  fechaEntrega: string;
  estadoBienestar: EstadoBienestar | null;
  observaciones: string | null;
  reporteComentarios: string | null;
  reporteEnviadoEn: Date | null;
}

const FECHA = (columna: string, alias: string): string =>
  `to_char(${columna}, 'YYYY-MM-DD') AS "${alias}"`;

const COLUMNAS_BASE = [
  'seg."id" AS "id"',
  'seg."adopcion_id" AS "adopcionId"',
  'seg."tipo" AS "tipo"',
  FECHA('seg."fecha_programada"', 'fechaProgramada'),
  FECHA('seg."fecha_realizada"', 'fechaRealizada'),
  'seg."estado" AS "estado"',
  // Vencido por estado o por fecha: no espera a que corra la tarea diaria.
  `(seg."estado" = 'vencido' OR (seg."estado" = 'programado' AND seg."fecha_programada" < CAST(:hoy AS date))) AS "vencido"`,
  'seg."reporte_enviado_en" IS NOT NULL AS "tieneReporte"',
  'm."id" AS "mascotaId"',
  'm."nombre" AS "mascotaNombre"',
];
// Solo el nombre del adoptante: nunca documento, correo ni dirección.
const COLUMNAS_FUNDACION = [
  ...COLUMNAS_BASE,
  `concat_ws(' ', ad."primer_nombre", ad."segundo_nombre", ad."primer_apellido", ad."segundo_apellido") AS "adoptanteNombre"`,
];
const COLUMNAS_ADOPTANTE = [...COLUMNAS_BASE, 'f."nombre" AS "fundacionNombre"'];
const COLUMNAS_DETALLE = [
  FECHA('a."fecha_entrega"', 'fechaEntrega'),
  'seg."estado_bienestar" AS "estadoBienestar"',
  'seg."observaciones" AS "observaciones"',
  'seg."reporte_adoptante" AS "reporteComentarios"',
  'seg."reporte_enviado_en" AS "reporteEnviadoEn"',
];

const aBase = (f: FilaBase): SeguimientoBase => ({
  id: f.id,
  adopcionId: f.adopcionId,
  tipo: f.tipo,
  fechaProgramada: f.fechaProgramada,
  fechaRealizada: f.fechaRealizada,
  estado: f.estado,
  vencido: f.vencido,
  tieneReporte: f.tieneReporte,
  mascota: { id: f.mascotaId, nombre: f.mascotaNombre },
});
const aListaFundacion = (f: FilaFundacion): SeguimientoListaFundacion => ({
  ...aBase(f),
  adoptante: { nombreCompleto: f.adoptanteNombre },
});
const aListaAdoptante = (f: FilaAdoptante): SeguimientoListaAdoptante => ({
  ...aBase(f),
  fundacion: { nombre: f.fundacionNombre },
});

/**
 * `UPDATE … RETURNING` por SQL directo: el driver de Postgres entrega `[filas, cantidad]` en lugar
 * de las filas, así que se normaliza aquí.
 */
function filasDe<T>(crudo: unknown): T[] {
  if (Array.isArray(crudo) && crudo.length === 2 && Array.isArray(crudo[0])) {
    return crudo[0] as T[];
  }
  return crudo as T[];
}

/**
 * Dueño de `seguimiento` y `seguimiento_evidencia`. Las lecturas hacen joins de solo lectura
 * (`seguimiento → adopcion → solicitud → mascota`, `solicitud → adoptante` y `mascota →
 * fundacion`) para comprobar la propiedad del rol en la misma sentencia; la excepción está
 * documentada en architecture.md. Nunca escribe en tablas ajenas ni inyecta un repository ajeno.
 */
@Injectable()
export class SeguimientosRepository {
  constructor(
    @InjectRepository(Seguimiento) private readonly seguimientos: Repository<Seguimiento>,
    @InjectRepository(SeguimientoEvidencia)
    private readonly evidencias: Repository<SeguimientoEvidencia>,
  ) {}

  enTransaccion<T>(trabajo: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.seguimientos.manager.transaction(trabajo);
  }

  // ---- Escrituras (siempre con el `manager` de la transacción del llamador) ---------------

  /**
   * `FOR SHARE` sobre la adopción: el INSERT de `seguimiento` solo toma `FOR KEY SHARE`, compatible
   * con el UPDATE del cierre; este bloqueo es el que serializa «programar» contra «cerrar».
   * La propiedad de la fundación se comprueba en la misma sentencia.
   */
  async bloquearAdopcionParaProgramar(
    manager: EntityManager,
    adopcionId: number,
    fundacionId: number,
  ): Promise<AdopcionParaProgramar | null> {
    const filas: { id: number; estado: EstadoAdopcion; fechaEntrega: string; mascotaId: number }[] =
      await manager.query(
        `SELECT a."id" AS "id", a."estado" AS "estado",
                to_char(a."fecha_entrega", 'YYYY-MM-DD') AS "fechaEntrega", s."mascota_id" AS "mascotaId"
           FROM "adopcion" a
           JOIN "solicitud_adopcion" s ON s."id" = a."solicitud_id"
           JOIN "mascota" m ON m."id" = s."mascota_id"
          WHERE a."id" = $1 AND m."fundacion_id" = $2
            FOR SHARE OF a`,
        [adopcionId, fundacionId],
      );
    return filas[0] ?? null;
  }

  async insertar(
    manager: EntityManager,
    adopcionId: number,
    tipo: TipoSeguimiento,
    fechaProgramada: string,
  ): Promise<number> {
    const resultado = await manager
      .getRepository(Seguimiento)
      .insert({ adopcionId, tipo, fechaProgramada });
    return (resultado.identifiers[0] as { id: number }).id;
  }

  /** Solo lectura, para los avisos: sin filtro de propiedad porque el llamador no es un usuario. */
  async buscarParaAviso(id: number): Promise<SeguimientoParaAviso | null> {
    const filas: SeguimientoParaAviso[] = await this.seguimientos.manager.query(
      `SELECT seg."tipo" AS "tipo", to_char(seg."fecha_programada", 'YYYY-MM-DD') AS "fechaProgramada",
              seg."adopcion_id" AS "adopcionId", m."nombre" AS "mascotaNombre",
              f."id" AS "fundacionId", f."nombre" AS "fundacionNombre",
              f."usuario_id" AS "fundacionUsuarioId", ad."usuario_id" AS "adoptanteUsuarioId"
         FROM "seguimiento" seg
         JOIN "adopcion" a ON a."id" = seg."adopcion_id"
         JOIN "solicitud_adopcion" s ON s."id" = a."solicitud_id"
         JOIN "mascota" m ON m."id" = s."mascota_id"
         JOIN "fundacion" f ON f."id" = m."fundacion_id"
         JOIN "adoptante" ad ON ad."id" = s."adoptante_id"
        WHERE seg."id" = $1`,
      [id],
    );
    return filas[0] ?? null;
  }

  /** Bloquea el seguimiento de su dueño hasta el fin de la transacción (`FOR UPDATE OF seg`). */
  bloquearParaAccion(
    manager: EntityManager,
    id: number,
    dueno: DuenoSeguimiento,
  ): Promise<SeguimientoParaAccion | null> {
    return this.leerParaAccion(id, dueno, manager);
  }

  /** Lectura sin bloqueo (precomprobación antes de guardar archivos). */
  buscarParaAccion(id: number, dueno: DuenoSeguimiento): Promise<SeguimientoParaAccion | null> {
    return this.leerParaAccion(id, dueno);
  }

  private async leerParaAccion(
    id: number,
    dueno: DuenoSeguimiento,
    manager?: EntityManager,
  ): Promise<SeguimientoParaAccion | null> {
    const propiedad =
      dueno.tipo === 'fundacion' ? 'm."fundacion_id" = $2' : 's."adoptante_id" = $2';
    const duenoId = dueno.tipo === 'fundacion' ? dueno.fundacionId : dueno.adoptanteId;
    const filas: SeguimientoParaAccion[] = await (manager ?? this.seguimientos.manager).query(
      `SELECT seg."id" AS "id", seg."adopcion_id" AS "adopcionId", s."mascota_id" AS "mascotaId",
              m."fundacion_id" AS "fundacionId", seg."tipo" AS "tipo", seg."estado" AS "estado",
              to_char(a."fecha_entrega", 'YYYY-MM-DD') AS "fechaEntrega",
              seg."reporte_enviado_en" AS "reporteEnviadoEn"
         FROM "seguimiento" seg
         JOIN "adopcion" a ON a."id" = seg."adopcion_id"
         JOIN "solicitud_adopcion" s ON s."id" = a."solicitud_id"
         JOIN "mascota" m ON m."id" = s."mascota_id"
        WHERE seg."id" = $1 AND ${propiedad}${manager ? ' FOR UPDATE OF seg' : ''}`,
      [id, duenoId],
    );
    return filas[0] ?? null;
  }

  /** `UPDATE` condicionado a un seguimiento pendiente: `false` si otro lo cambió antes. */
  async guardarReporte(manager: EntityManager, id: number, comentarios: string): Promise<boolean> {
    const resultado = await manager
      .getRepository(Seguimiento)
      .createQueryBuilder()
      .update(Seguimiento)
      .set({ reporteAdoptante: comentarios, reporteEnviadoEn: () => 'now()' })
      .where('"id" = :id AND "estado" IN (:...pendientes)', {
        id,
        pendientes: EstadoSeguimientoMaquina.pendientes(),
      })
      .execute();
    return (resultado.affected ?? 0) > 0;
  }

  async registrarResultado(
    manager: EntityManager,
    id: number,
    datos: DatosResultado,
  ): Promise<boolean> {
    const resultado = await manager
      .getRepository(Seguimiento)
      .createQueryBuilder()
      .update(Seguimiento)
      .set({
        estado: EstadoSeguimiento.Realizado,
        fechaRealizada: datos.fechaRealizada,
        estadoBienestar: datos.estadoBienestar,
        observaciones: datos.observaciones,
      })
      .where('"id" = :id AND "estado" IN (:...desde)', {
        id,
        desde: EstadoSeguimientoMaquina.origenesPara(EstadoSeguimiento.Realizado, 'resultado'),
      })
      .execute();
    return (resultado.affected ?? 0) > 0;
  }

  /** Cancela los pendientes de una adopción que se cierra y devuelve los ids afectados. */
  async cancelarPendientesDeAdopcion(
    manager: EntityManager,
    adopcionId: number,
  ): Promise<number[]> {
    const resultado = await manager
      .getRepository(Seguimiento)
      .createQueryBuilder()
      .update(Seguimiento)
      .set({ estado: EstadoSeguimiento.Cancelado })
      .where('"adopcion_id" = :adopcionId AND "estado" IN (:...desde)', {
        adopcionId,
        desde: EstadoSeguimientoMaquina.origenesPara(EstadoSeguimiento.Cancelado, 'cierre'),
      })
      .returning('id')
      .execute();
    return (resultado.raw as { id: number }[]).map((f) => f.id);
  }

  async insertarEvidencias(
    manager: EntityManager,
    seguimientoId: number,
    claves: readonly string[],
    origen: OrigenEvidencia,
  ): Promise<void> {
    if (claves.length === 0) return;
    await manager
      .getRepository(SeguimientoEvidencia)
      .insert(claves.map((url) => ({ seguimientoId, url, origen })));
  }

  /** Borra las fotos de un origen y devuelve sus claves (para eliminar los archivos tras el commit). */
  async borrarEvidencias(
    manager: EntityManager,
    seguimientoId: number,
    origen: OrigenEvidencia,
  ): Promise<string[]> {
    const resultado = await manager
      .getRepository(SeguimientoEvidencia)
      .createQueryBuilder()
      .delete()
      .from(SeguimientoEvidencia)
      .where('"seguimiento_id" = :seguimientoId AND "origen" = :origen', { seguimientoId, origen })
      .returning('url')
      .execute();
    return (resultado.raw as { url: string }[]).map((f) => f.url);
  }

  // ---- Tareas programadas ----------------------------------------------------------------------

  /**
   * Pasa a `vencido` un lote de `programado` con fecha anterior a `hoy`. `SKIP LOCKED` reparte
   * filas distintas entre ejecuciones simultáneas y el `UPDATE` condicionado impide que una fila
   * cambie dos veces.
   */
  async vencerLote(
    manager: EntityManager,
    hoy: string,
    limite: number,
  ): Promise<SeguimientoDeTarea[]> {
    const desde = EstadoSeguimientoMaquina.origenesPara(EstadoSeguimiento.Vencido, 'tarea');
    const crudo: unknown = await manager.query(
      `UPDATE "seguimiento" SET "estado" = 'vencido'
        WHERE "id" IN (SELECT "id" FROM "seguimiento"
                        WHERE "estado" = ANY($1::"seguimiento_estado_enum"[])
                          AND "fecha_programada" < $2::date
                        ORDER BY "id" LIMIT $3 FOR UPDATE SKIP LOCKED)
          AND "estado" = ANY($1::"seguimiento_estado_enum"[])
        RETURNING "id", "adopcion_id" AS "adopcionId",
                  to_char("fecha_programada", 'YYYY-MM-DD') AS "fechaProgramada"`,
      [desde, hoy, limite],
    );
    return filasDe<SeguimientoDeTarea>(crudo);
  }

  /** Marca (y devuelve) un lote de `programado` que vence entre `hoy` y `hoy + dias` sin recordatorio. */
  async recordarLote(
    manager: EntityManager,
    hoy: string,
    dias: number,
    limite: number,
  ): Promise<SeguimientoDeTarea[]> {
    const crudo: unknown = await manager.query(
      `UPDATE "seguimiento" SET "recordatorio_enviado_en" = now()
        WHERE "id" IN (SELECT "id" FROM "seguimiento"
                        WHERE "estado" = 'programado' AND "recordatorio_enviado_en" IS NULL
                          AND "fecha_programada" BETWEEN $1::date AND ($1::date + $2::int)
                        ORDER BY "id" LIMIT $3 FOR UPDATE SKIP LOCKED)
          AND "estado" = 'programado' AND "recordatorio_enviado_en" IS NULL
        RETURNING "id", "adopcion_id" AS "adopcionId",
                  to_char("fecha_programada", 'YYYY-MM-DD') AS "fechaProgramada"`,
      [hoy, dias, limite],
    );
    return filasDe<SeguimientoDeTarea>(crudo);
  }

  // ---- Lecturas con la propiedad del rol en la misma consulta -----------------------------------

  private base(): SelectQueryBuilder<Seguimiento> {
    return this.seguimientos
      .createQueryBuilder('seg')
      .innerJoin('seg.adopcion', 'a')
      .innerJoin('a.solicitud', 's')
      .innerJoin('s.mascota', 'm');
  }

  private deFundacion(fundacionId: number, hoy: string): SelectQueryBuilder<Seguimiento> {
    return this.base()
      .innerJoin('s.adoptante', 'ad')
      .where('m."fundacion_id" = :fundacionId', { fundacionId })
      .setParameter('hoy', hoy);
  }

  private deAdoptante(adoptanteId: number, hoy: string): SelectQueryBuilder<Seguimiento> {
    return this.base()
      .innerJoin('m.fundacion', 'f')
      .where('s."adoptante_id" = :adoptanteId', { adoptanteId })
      .setParameter('hoy', hoy);
  }

  private filtrar(
    consulta: SelectQueryBuilder<Seguimiento>,
    filtro: FiltroSeguimientos,
  ): SelectQueryBuilder<Seguimiento> {
    if (filtro.estado) consulta.andWhere('seg."estado" = :estado', { estado: filtro.estado });
    if (filtro.tipo) consulta.andWhere('seg."tipo" = :tipo', { tipo: filtro.tipo });
    if (filtro.adopcionId !== undefined) {
      consulta.andWhere('seg."adopcion_id" = :adopcionId', { adopcionId: filtro.adopcionId });
    }
    return consulta;
  }

  async listarDeFundacion(
    fundacionId: number,
    filtro: FiltroSeguimientos,
    hoy: string,
    skip: number,
    take: number,
  ): Promise<[SeguimientoListaFundacion[], number]> {
    const filtrada = () => this.filtrar(this.deFundacion(fundacionId, hoy), filtro);
    const total = await filtrada().getCount();
    const filas = await filtrada()
      .select(COLUMNAS_FUNDACION)
      .orderBy('seg."fecha_programada"', 'DESC')
      .addOrderBy('seg."id"', 'DESC')
      .offset(skip)
      .limit(take)
      .getRawMany<FilaFundacion>();
    return [filas.map(aListaFundacion), total];
  }

  async listarDeAdoptante(
    adoptanteId: number,
    filtro: FiltroSeguimientos,
    hoy: string,
    skip: number,
    take: number,
  ): Promise<[SeguimientoListaAdoptante[], number]> {
    const filtrada = () => this.filtrar(this.deAdoptante(adoptanteId, hoy), filtro);
    const total = await filtrada().getCount();
    const filas = await filtrada()
      .select(COLUMNAS_ADOPTANTE)
      .orderBy('seg."fecha_programada"', 'DESC')
      .addOrderBy('seg."id"', 'DESC')
      .offset(skip)
      .limit(take)
      .getRawMany<FilaAdoptante>();
    return [filas.map(aListaAdoptante), total];
  }

  async obtenerDeFundacion(
    id: number,
    fundacionId: number,
    hoy: string,
  ): Promise<SeguimientoDetalleFundacion | null> {
    const fila = await this.deFundacion(fundacionId, hoy)
      .select([...COLUMNAS_FUNDACION, ...COLUMNAS_DETALLE])
      .andWhere('seg."id" = :id', { id })
      .getRawOne<FilaFundacion & FilaDetalle>();
    if (!fila) return null;
    const fotos = await this.fotosDe(id);
    return {
      ...aListaFundacion(fila),
      fechaEntrega: fila.fechaEntrega,
      estadoBienestar: fila.estadoBienestar,
      observaciones: fila.observaciones,
      reporte: aReporte(fila, fotos.adoptante),
      evidencias: fotos.fundacion,
    };
  }

  async obtenerDeAdoptante(
    id: number,
    adoptanteId: number,
    hoy: string,
  ): Promise<SeguimientoDetalleAdoptante | null> {
    const fila = await this.deAdoptante(adoptanteId, hoy)
      .select([...COLUMNAS_ADOPTANTE, ...COLUMNAS_DETALLE])
      .andWhere('seg."id" = :id', { id })
      .getRawOne<FilaAdoptante & FilaDetalle>();
    if (!fila) return null;
    const fotos = await this.fotosDe(id);
    // Bienestar, observaciones y evidencias de la fundación se descartan aquí: nunca salen al adoptante.
    return {
      ...aListaAdoptante(fila),
      fechaEntrega: fila.fechaEntrega,
      reporte: aReporte(fila, fotos.adoptante),
    };
  }

  private async fotosDe(
    seguimientoId: number,
  ): Promise<Record<OrigenEvidencia, FotoSeguimiento[]>> {
    const filas = await this.evidencias.find({
      select: { id: true, origen: true },
      where: { seguimientoId },
      order: { id: 'ASC' },
    });
    const salida: Record<OrigenEvidencia, FotoSeguimiento[]> = { fundacion: [], adoptante: [] };
    for (const fila of filas) salida[fila.origen].push({ id: fila.id });
    return salida;
  }

  /** Hasta 20 seguimientos recientes por adopción en una sola consulta (sin N+1). */
  async resumenPorAdopciones(
    adopcionIds: readonly number[],
    hoy: string,
  ): Promise<Map<number, ResumenSeguimiento[]>> {
    const resumen = new Map<number, ResumenSeguimiento[]>();
    if (adopcionIds.length === 0) return resumen;
    const filas: (ResumenSeguimiento & { adopcionId: number })[] =
      await this.seguimientos.manager.query(
        `SELECT t.* FROM (
           SELECT seg."id" AS "id", seg."adopcion_id" AS "adopcionId", seg."tipo" AS "tipo",
                  to_char(seg."fecha_programada", 'YYYY-MM-DD') AS "fechaProgramada",
                  to_char(seg."fecha_realizada", 'YYYY-MM-DD') AS "fechaRealizada",
                  seg."estado" AS "estado",
                  (seg."estado" = 'vencido' OR (seg."estado" = 'programado' AND seg."fecha_programada" < $2::date)) AS "vencido",
                  row_number() OVER (PARTITION BY seg."adopcion_id"
                                     ORDER BY seg."fecha_programada" DESC, seg."id" DESC) AS "orden"
             FROM "seguimiento" seg WHERE seg."adopcion_id" = ANY($1::int[])) t
          WHERE t."orden" <= $3
          ORDER BY t."adopcionId", t."orden"`,
        [adopcionIds, hoy, MAX_RESUMEN_POR_ADOPCION],
      );
    for (const { adopcionId, ...fila } of filas) {
      const lista = resumen.get(adopcionId) ?? [];
      lista.push({
        id: fila.id,
        tipo: fila.tipo,
        fechaProgramada: fila.fechaProgramada,
        fechaRealizada: fila.fechaRealizada,
        estado: fila.estado,
        vencido: fila.vencido,
      });
      resumen.set(adopcionId, lista);
    }
    return resumen;
  }

  /**
   * Clave de una foto con el filtro de propiedad del rol: `null` si no es suya. Al adoptante solo
   * se le entregan las de su propio reporte (`origen = adoptante`).
   */
  async claveDeFoto(
    seguimientoId: number,
    evidenciaId: number,
    dueno: DuenoSeguimiento,
  ): Promise<string | null> {
    const consulta = this.evidencias
      .createQueryBuilder('e')
      .innerJoin('e.seguimiento', 'seg')
      .innerJoin('seg.adopcion', 'a')
      .innerJoin('a.solicitud', 's')
      .innerJoin('s.mascota', 'm')
      .select('e."url"', 'clave')
      .where('e."id" = :evidenciaId AND e."seguimiento_id" = :seguimientoId', {
        evidenciaId,
        seguimientoId,
      });
    if (dueno.tipo === 'fundacion') {
      consulta.andWhere('m."fundacion_id" = :fundacionId', { fundacionId: dueno.fundacionId });
    } else {
      consulta
        .andWhere('s."adoptante_id" = :adoptanteId', { adoptanteId: dueno.adoptanteId })
        .andWhere('e."origen" = :origen', { origen: OrigenEvidencia.Adoptante });
    }
    const fila = await consulta.getRawOne<{ clave: string }>();
    return fila?.clave ?? null;
  }
}

function aReporte(fila: FilaDetalle, fotos: FotoSeguimiento[]): ReporteAdoptante | null {
  if (fila.reporteEnviadoEn === null || fila.reporteComentarios === null) return null;
  return { comentarios: fila.reporteComentarios, enviadoEn: fila.reporteEnviadoEn, fotos };
}
