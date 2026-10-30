import { ESTADOS_SOLICITUD, type ConsultaSolicitudes, type EstadoSolicitud } from '../types';

export const RUTA_SOLICITUDES = '/fundacion/solicitudes';
export const RUTA_ADOPCIONES = '/fundacion/adopciones';

interface Parametros {
  get(nombre: string): string | null;
}

/** Filtros y página de la URL; un valor desconocido o inválido se ignora. */
export function leerConsulta(params: Parametros): ConsultaSolicitudes {
  const bruto = params.get('pagina');
  const pagina = bruto && /^\d{1,6}$/.test(bruto) ? Number(bruto) : 1;
  const estado = params.get('estado');
  const mascota = params.get('mascota');
  const mascotaId = mascota && /^\d{1,10}$/.test(mascota) ? Number(mascota) : 0;
  return {
    pagina: pagina >= 1 ? pagina : 1,
    estado: ESTADOS_SOLICITUD.includes(estado as EstadoSolicitud)
      ? (estado as EstadoSolicitud)
      : undefined,
    mascotaId: mascotaId > 0 ? mascotaId : undefined,
  };
}

/** `?estado=pendiente&mascota=7&pagina=2`, o cadena vacía con los valores por defecto. */
export function consultaAUrl(consulta: ConsultaSolicitudes): string {
  const partes = new URLSearchParams();
  if (consulta.estado) partes.set('estado', consulta.estado);
  if (consulta.mascotaId) partes.set('mascota', String(consulta.mascotaId));
  if (consulta.pagina > 1) partes.set('pagina', String(consulta.pagina));
  const texto = partes.toString();
  return texto ? `?${texto}` : '';
}

export function rutaLista(consulta: ConsultaSolicitudes): string {
  return `${RUTA_SOLICITUDES}${consultaAUrl(consulta)}`;
}

/** El detalle conserva los filtros y la página para volver a la misma lista. */
export function rutaRevision(id: number, consulta: ConsultaSolicitudes): string {
  return `${RUTA_SOLICITUDES}/${id}${consultaAUrl(consulta)}`;
}

/** El id de una ruta debe ser un entero positivo; si no, es «no encontrada» sin llamar a la API. */
export function leerId(valor: string | null | undefined): number | null {
  if (!valor || !/^\d{1,10}$/.test(valor)) return null;
  const id = Number(valor);
  return id > 0 ? id : null;
}
