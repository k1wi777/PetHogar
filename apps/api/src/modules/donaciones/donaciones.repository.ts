import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Donacion } from './entities/donacion.entity';
import type {
  DatosNuevaDonacion,
  DonacionGuardada,
  DonacionParaAviso,
  FilaAgregado,
  FilaDonacion,
  FiltroDonaciones,
} from './donaciones.types';

/**
 * Cláusula `WHERE` única: la página y el agregado de totales la construyen con esta función, de
 * modo que no pueden divergir. La propiedad (`fundacion_id`) va siempre en la misma sentencia.
 */
export function clausulaDeDonaciones(
  fundacionId: number,
  filtro: FiltroDonaciones,
): { where: string; parametros: unknown[] } {
  const condiciones = ['"fundacion_id" = $1'];
  const parametros: unknown[] = [fundacionId];
  const agregar = (sql: (n: number) => string, valor: unknown): void => {
    parametros.push(valor);
    condiciones.push(sql(parametros.length));
  };
  if (filtro.desde) agregar((n) => `"fecha" >= $${n}::timestamptz`, filtro.desde.toISOString());
  const hasta = filtro.hastaExclusivo;
  if (hasta) agregar((n) => `"fecha" < $${n}::timestamptz`, hasta.toISOString());
  if (filtro.tipo) agregar((n) => `"tipo" = $${n}`, filtro.tipo);
  return { where: condiciones.join(' AND '), parametros };
}

/** Dueño de `donacion`. Toda lectura o escritura de la fundación lleva `fundacion_id`. */
@Injectable()
export class DonacionesRepository {
  constructor(@InjectRepository(Donacion) private readonly donaciones: Repository<Donacion>) {}

  /** Un único `INSERT`: es atómico por sí solo. El monto viaja como cadena. */
  async insertar(datos: DatosNuevaDonacion): Promise<DonacionGuardada> {
    const resultado = await this.donaciones
      .createQueryBuilder()
      .insert()
      .into(Donacion)
      .values({
        fundacionId: datos.fundacionId,
        usuarioId: datos.usuarioId,
        nombreDonante: datos.nombreDonante,
        tipo: datos.tipo,
        monto: datos.monto,
        descripcionEspecie: datos.descripcionEspecie,
        comprobanteUrl: datos.comprobanteClave,
      })
      .returning(['id', 'fecha', 'monto'])
      .execute();
    return (resultado.raw as DonacionGuardada[])[0];
  }

  /** Orden estable: más reciente primero y desempate por `id`. */
  listar(
    fundacionId: number,
    filtro: FiltroDonaciones,
    skip: number,
    take: number,
  ): Promise<FilaDonacion[]> {
    const { where, parametros } = clausulaDeDonaciones(fundacionId, filtro);
    return this.donaciones.query(
      `SELECT "id", "tipo", "monto"::text AS "monto", "descripcion_especie" AS "descripcionEspecie",
              "fecha", "usuario_id" AS "usuarioId", "nombre_donante" AS "nombreDonante",
              "comprobante_url" IS NOT NULL AS "tieneComprobante"
         FROM "donacion" WHERE ${where}
        ORDER BY "fecha" DESC, "id" DESC
        LIMIT ${Number(take)} OFFSET ${Number(skip)}`,
      parametros,
    );
  }

  /** Una sola pasada sobre TODO el conjunto filtrado; `SUM` de `numeric` es exacto. */
  agregar(fundacionId: number, filtro: FiltroDonaciones): Promise<FilaAgregado[]> {
    const { where, parametros } = clausulaDeDonaciones(fundacionId, filtro);
    return this.donaciones.query(
      `SELECT "tipo", COUNT(*)::int AS "cantidad", COALESCE(SUM("monto"), 0.00)::text AS "monto"
         FROM "donacion" WHERE ${where} GROUP BY "tipo"`,
      parametros,
    );
  }

  /** `null` si la donación es ajena, no existe o no tiene comprobante. */
  async claveComprobanteDeFundacion(id: number, fundacionId: number): Promise<string | null> {
    const filas: { clave: string | null }[] = await this.donaciones.query(
      `SELECT "comprobante_url" AS "clave" FROM "donacion" WHERE "id" = $1 AND "fundacion_id" = $2`,
      [id, fundacionId],
    );
    return filas[0]?.clave ?? null;
  }

  async buscarParaAviso(id: number): Promise<DonacionParaAviso | null> {
    const filas: DonacionParaAviso[] = await this.donaciones.query(
      `SELECT "tipo", "monto"::text AS "monto", "descripcion_especie" AS "descripcionEspecie",
              "fecha", "usuario_id" AS "usuarioId"
         FROM "donacion" WHERE "id" = $1`,
      [id],
    );
    return filas[0] ?? null;
  }
}
