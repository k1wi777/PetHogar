import { ESTADOS_MASCOTA, type ConsultaMascotas, type EstadoMascota } from '../types';

export const RUTA_MASCOTAS = '/fundacion/mascotas';

interface Parametros {
  get(nombre: string): string | null;
}

/** Filtro y página de la URL; un valor desconocido o inválido se ignora (todas, página 1). */
export function leerConsulta(params: Parametros): ConsultaMascotas {
  const bruto = params.get('pagina');
  const pagina = bruto && /^\d{1,6}$/.test(bruto) ? Number(bruto) : 1;
  const estado = params.get('estado');
  return {
    pagina: pagina >= 1 ? pagina : 1,
    estado: ESTADOS_MASCOTA.includes(estado as EstadoMascota)
      ? (estado as EstadoMascota)
      : undefined,
  };
}

/** `?pagina=2&estado=disponible`, o cadena vacía con los valores por defecto. */
export function consultaAUrl(consulta: ConsultaMascotas): string {
  const partes = new URLSearchParams();
  if (consulta.pagina > 1) partes.set('pagina', String(consulta.pagina));
  if (consulta.estado) partes.set('estado', consulta.estado);
  const texto = partes.toString();
  return texto ? `?${texto}` : '';
}

export function rutaLista(consulta: ConsultaMascotas): string {
  return `${RUTA_MASCOTAS}${consultaAUrl(consulta)}`;
}

export const PESTANAS_FICHA = ['datos', 'fotos', 'historial'] as const;
export type PestanaFicha = (typeof PESTANAS_FICHA)[number];

export function leerPestana(valor: string | null): PestanaFicha {
  return PESTANAS_FICHA.includes(valor as PestanaFicha) ? (valor as PestanaFicha) : 'datos';
}

/** El id de una ruta debe ser un entero positivo; si no, es «no encontrada» sin llamar a la API. */
export function leerId(valor: string | null | undefined): number | null {
  if (!valor || !/^\d{1,10}$/.test(valor)) return null;
  const id = Number(valor);
  return id > 0 ? id : null;
}
