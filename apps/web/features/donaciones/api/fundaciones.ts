import type { FundacionDestino } from '../types';

export const MAX_NOMBRE_FUNDACION = 100;

interface Parametros {
  get(nombre: string): string | null;
}

/**
 * Fuente de la fundación destinataria. Hoy sale de la URL (`?fundacion=<id>&nombre=…`, que arma la
 * ficha de una mascota) porque la API no ofrece un listado de fundaciones aprobadas para el
 * adoptante. Si algún día existe `GET /fundaciones`, solo cambia este módulo (y la pantalla).
 * El nombre es solo presentación: la API valida el id y responde 404 si no recibe donaciones.
 */
export function leerFundacionDestino(params: Parametros): FundacionDestino | null {
  const bruto = params.get('fundacion');
  if (!bruto || !/^\d{1,10}$/.test(bruto)) return null;
  const id = Number(bruto);
  if (id <= 0) return null;
  const nombre = (params.get('nombre') ?? '').trim().slice(0, MAX_NOMBRE_FUNDACION);
  return { id, nombre: nombre || 'la fundación elegida' };
}
