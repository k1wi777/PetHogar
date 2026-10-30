import type { ResumenSeguimiento } from '../types';

/** Un reporte se puede enviar mientras el seguimiento de tipo reporte siga programado o vencido. */
export function admiteReporte(s: Pick<ResumenSeguimiento, 'tipo' | 'estado' | 'vencido'>): boolean {
  return s.tipo === 'reporte' && (s.estado === 'programado' || s.estado === 'vencido');
}

export const RUTA_ADOPCIONES = '/adoptante/adopciones';
export const rutaSeguimiento = (id: number): string => `${RUTA_ADOPCIONES}/seguimientos/${id}`;

export function leerId(valor: string | null | undefined): number | null {
  if (!valor || !/^\d{1,10}$/.test(valor)) return null;
  const id = Number(valor);
  return id > 0 ? id : null;
}
