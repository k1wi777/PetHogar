import type { FiltroUsuarios } from './usuarios.types';

/** Antepone `\` a `\`, `%` y `_` para que el texto buscado se compare literalmente en un LIKE. */
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, '\\$&');
}

/** Patrón «contiene» ya escapado; se pasa siempre como parámetro, nunca concatenado en el SQL. */
export function patronContiene(texto: string): string {
  return `%${escaparLike(texto)}%`;
}

const NOMBRE_ADOPTANTE = `concat_ws(' ', a."primer_nombre", a."segundo_nombre", a."primer_apellido", a."segundo_apellido")`;

/** Expresión SQL del nombre visible: el del adoptante, el de la fundación o `NULL`. */
export const SQL_NOMBRE_USUARIO = `COALESCE(NULLIF(${NOMBRE_ADOPTANTE}, ''), f."nombre")`;

export interface FiltroSql {
  condiciones: string[];
  parametros: Record<string, string>;
}

/**
 * Condiciones y parámetros del listado (alias: `u` usuario, `r` rol, `a` adoptante, `f` fundación).
 * Los filtros vacíos se ignoran; cada comparación declara `ESCAPE '\\'`.
 */
export function construirFiltroUsuarios(filtros: FiltroUsuarios): FiltroSql {
  const condiciones: string[] = [];
  const parametros: Record<string, string> = {};
  const nombre = filtros.nombre?.trim();
  if (nombre) {
    condiciones.push(
      `(${NOMBRE_ADOPTANTE} ILIKE :nombre ESCAPE '\\' OR f."nombre" ILIKE :nombre ESCAPE '\\')`,
    );
    parametros.nombre = patronContiene(nombre);
  }
  const correo = filtros.correo?.trim();
  if (correo) {
    condiciones.push(`u."email" ILIKE :correo ESCAPE '\\'`);
    parametros.correo = patronContiene(correo);
  }
  if (filtros.rol) {
    condiciones.push(`r."nombre" = :rol`);
    parametros.rol = filtros.rol;
  }
  return { condiciones, parametros };
}
