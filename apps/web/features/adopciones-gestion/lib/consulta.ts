import { ESTADOS_ADOPCION, type ConsultaAdopciones, type EstadoAdopcion } from '../types';

export const RUTA_ADOPCIONES = '/fundacion/adopciones';
export const rutaSeguimiento = (id: number): string => `${RUTA_ADOPCIONES}/seguimientos/${id}`;

interface Parametros {
  get(nombre: string): string | null;
}

/** Filtro y página de la URL; un valor desconocido o inválido se ignora. */
export function leerConsulta(params: Parametros): ConsultaAdopciones {
  const bruto = params.get('pagina');
  const pagina = bruto && /^\d{1,6}$/.test(bruto) ? Number(bruto) : 1;
  const estado = params.get('estado');
  return {
    pagina: pagina >= 1 ? pagina : 1,
    estado: ESTADOS_ADOPCION.includes(estado as EstadoAdopcion)
      ? (estado as EstadoAdopcion)
      : undefined,
  };
}

/** `?estado=activa&pagina=2`, o cadena vacía con los valores por defecto. */
export function consultaAUrl(consulta: ConsultaAdopciones): string {
  const partes = new URLSearchParams();
  if (consulta.estado) partes.set('estado', consulta.estado);
  if (consulta.pagina > 1) partes.set('pagina', String(consulta.pagina));
  const texto = partes.toString();
  return texto ? `?${texto}` : '';
}

export function rutaLista(consulta: ConsultaAdopciones): string {
  return `${RUTA_ADOPCIONES}${consultaAUrl(consulta)}`;
}

/** El id de una ruta debe ser un entero positivo; si no, es «no encontrada» sin llamar a la API. */
export function leerId(valor: string | null | undefined): number | null {
  if (!valor || !/^\d{1,10}$/.test(valor)) return null;
  const id = Number(valor);
  return id > 0 ? id : null;
}
