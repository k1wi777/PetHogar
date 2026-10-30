import {
  ESTADOS_VALIDACION,
  ESTADO_POR_DEFECTO,
  type ConsultaFundaciones,
  type EstadoValidacion,
} from '../types';

export const RUTA_FUNDACIONES = '/administrador/fundaciones';

interface Parametros {
  get(nombre: string): string | null;
}

/** Estado y página de la URL; un valor desconocido o inválido se ignora. */
export function leerConsulta(params: Parametros): ConsultaFundaciones {
  const bruto = params.get('pagina');
  const pagina = bruto && /^\d{1,6}$/.test(bruto) ? Number(bruto) : 1;
  const estado = params.get('estado');
  return {
    pagina: pagina >= 1 ? pagina : 1,
    estado: ESTADOS_VALIDACION.includes(estado as EstadoValidacion)
      ? (estado as EstadoValidacion)
      : ESTADO_POR_DEFECTO,
  };
}

/** `?estado=aprobada&pagina=2`, o cadena vacía con los valores por defecto. */
export function consultaAUrl(consulta: ConsultaFundaciones): string {
  const partes = new URLSearchParams();
  if (consulta.estado !== ESTADO_POR_DEFECTO) partes.set('estado', consulta.estado);
  if (consulta.pagina > 1) partes.set('pagina', String(consulta.pagina));
  const texto = partes.toString();
  return texto ? `?${texto}` : '';
}

export function rutaLista(consulta: ConsultaFundaciones): string {
  return `${RUTA_FUNDACIONES}${consultaAUrl(consulta)}`;
}

/** El detalle conserva el filtro y la página para volver a la misma lista. */
export function rutaDetalle(id: number, consulta: ConsultaFundaciones): string {
  return `${RUTA_FUNDACIONES}/${id}${consultaAUrl(consulta)}`;
}

/** El id de una ruta debe ser un entero positivo; si no, es «no encontrada» sin llamar a la API. */
export function leerId(valor: string | null | undefined): number | null {
  if (!valor || !/^\d{1,10}$/.test(valor)) return null;
  const id = Number(valor);
  return id > 0 ? id : null;
}
