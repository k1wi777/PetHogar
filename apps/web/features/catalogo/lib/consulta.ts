import type { ConsultaCatalogo, FiltrosCatalogo, Tamano } from '../types';

export const TAMANOS: readonly Tamano[] = ['pequeño', 'mediano', 'grande'];
const EDAD_MAXIMA_MESES = 360;
// Límites de la API (ConsultaCatalogoDto).
const ID_MAXIMO = 2_147_483_647;
const CIUDAD_MAXIMA = 60;

export type ParametrosUrl = Record<string, string | string[] | undefined>;

function primero(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

function entero(valor: string | undefined, minimo: number, maximo: number): number | undefined {
  if (valor === undefined || !/^\d+$/.test(valor.trim())) return undefined;
  const n = Number(valor.trim());
  return Number.isSafeInteger(n) && n >= minimo && n <= maximo ? n : undefined;
}

export interface ResultadoParseo {
  filtros: FiltrosCatalogo;
  /** La edad mínima es mayor que la máxima: no se consulta con ese rango. */
  rangoInvalido: boolean;
}

/** Convierte los `searchParams` en filtros válidos; lo inválido se descarta sin romper la página. */
export function parsearFiltros(params: ParametrosUrl): ResultadoParseo {
  const tamanoCrudo = primero(params.tamano)?.trim();
  const ciudad = primero(params.ciudad)?.trim().slice(0, CIUDAD_MAXIMA);
  const filtros: FiltrosCatalogo = {
    especie: entero(primero(params.especie), 1, ID_MAXIMO),
    tamano: TAMANOS.find((t) => t === tamanoCrudo),
    edadMin: entero(primero(params.edadMin), 0, EDAD_MAXIMA_MESES),
    edadMax: entero(primero(params.edadMax), 0, EDAD_MAXIMA_MESES),
    ciudad: ciudad || undefined,
    pagina: entero(primero(params.pagina), 1, ID_MAXIMO) ?? 1,
  };
  const rangoInvalido =
    filtros.edadMin !== undefined &&
    filtros.edadMax !== undefined &&
    filtros.edadMin > filtros.edadMax;
  return { filtros, rangoInvalido };
}

/** Consulta con los únicos parámetros que admite la API; con rango incoherente no envía edades. */
export function aConsultaApi(filtros: FiltrosCatalogo, rangoInvalido: boolean): ConsultaCatalogo {
  return {
    especieId: filtros.especie,
    tamano: filtros.tamano,
    edadMinMeses: rangoInvalido ? undefined : filtros.edadMin,
    edadMaxMeses: rangoInvalido ? undefined : filtros.edadMax,
    ciudad: filtros.ciudad,
    page: filtros.pagina > 1 ? filtros.pagina : undefined,
  };
}

/** URL del catálogo con los filtros (omite los vacíos y la página 1). */
export function urlCatalogo(filtros: FiltrosCatalogo, pagina: number = filtros.pagina): string {
  const p = new URLSearchParams();
  if (filtros.especie !== undefined) p.set('especie', String(filtros.especie));
  if (filtros.tamano) p.set('tamano', filtros.tamano);
  if (filtros.edadMin !== undefined) p.set('edadMin', String(filtros.edadMin));
  if (filtros.edadMax !== undefined) p.set('edadMax', String(filtros.edadMax));
  if (filtros.ciudad) p.set('ciudad', filtros.ciudad);
  if (pagina > 1) p.set('pagina', String(pagina));
  const texto = p.toString();
  return texto ? `/adoptar?${texto}` : '/adoptar';
}

export function hayFiltros(filtros: FiltrosCatalogo): boolean {
  return (
    filtros.especie !== undefined ||
    filtros.tamano !== undefined ||
    filtros.edadMin !== undefined ||
    filtros.edadMax !== undefined ||
    filtros.ciudad !== undefined
  );
}
