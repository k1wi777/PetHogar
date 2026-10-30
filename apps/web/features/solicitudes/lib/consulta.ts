import { ESTADOS_SOLICITUD, type ConsultaSolicitudes, type EstadoSolicitud } from '../types';

export const RUTA_SOLICITUDES = '/adoptante/solicitudes';

interface Parametros {
  get(nombre: string): string | null;
}

/** Filtro y página de la URL; un valor desconocido o inválido se ignora. */
export function leerConsulta(params: Parametros): ConsultaSolicitudes {
  const bruto = params.get('pagina');
  const pagina = bruto && /^\d{1,6}$/.test(bruto) ? Number(bruto) : 1;
  const estado = params.get('estado');
  return {
    pagina: pagina >= 1 ? pagina : 1,
    estado: ESTADOS_SOLICITUD.includes(estado as EstadoSolicitud)
      ? (estado as EstadoSolicitud)
      : undefined,
  };
}

/** `?pagina=2&estado=pendiente`, o cadena vacía con los valores por defecto. */
export function consultaAUrl(consulta: ConsultaSolicitudes): string {
  const partes = new URLSearchParams();
  if (consulta.pagina > 1) partes.set('pagina', String(consulta.pagina));
  if (consulta.estado) partes.set('estado', consulta.estado);
  const texto = partes.toString();
  return texto ? `?${texto}` : '';
}

export function rutaLista(consulta: ConsultaSolicitudes): string {
  return `${RUTA_SOLICITUDES}${consultaAUrl(consulta)}`;
}

/** El detalle conserva filtro y página para volver a la misma lista. */
export function rutaDetalle(id: number, consulta: ConsultaSolicitudes): string {
  return `${RUTA_SOLICITUDES}/${id}${consultaAUrl(consulta)}`;
}

/** El id de una ruta debe ser un entero positivo; si no, es «no encontrada» sin llamar a la API. */
export function leerId(valor: string | null | undefined): number | null {
  if (!valor || !/^\d{1,10}$/.test(valor)) return null;
  const id = Number(valor);
  return id > 0 ? id : null;
}
