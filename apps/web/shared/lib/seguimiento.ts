/** Lo mínimo que se necesita de un seguimiento para saber si está vencido (lo comparten ambos roles). */
export interface EstadoSeguimiento {
  estado: string;
  vencido?: boolean;
}

/** Vencido por estado o porque la API lo marca por fecha aunque el estado siga «programado». */
export function esVencido(s: EstadoSeguimiento): boolean {
  return (
    s.estado === 'vencido' ||
    (s.vencido === true && s.estado !== 'realizado' && s.estado !== 'cancelado')
  );
}

/** Estado que se muestra: un programado ya vencido por fecha se presenta como «vencido». */
export function estadoVisible(s: EstadoSeguimiento): string {
  return esVencido(s) ? 'vencido' : s.estado;
}
