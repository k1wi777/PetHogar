import { esVencido } from '@/shared/lib/seguimiento';
import type { Pagina } from '@/shared/api/tipos';
import type { ResumenSeguimientos, SeguimientoDeLista } from '../types';

export const TOPE_DESTACADOS = 5;

const porFecha = (a: SeguimientoDeLista, b: SeguimientoDeLista) =>
  a.fechaProgramada.localeCompare(b.fechaProgramada) || a.id - b.id;

/**
 * Combina `estado=vencido` (su `total` es exacto) con los `programado` ya pasados de fecha, que
 * la API marca con `vencido` aunque su estado aún no se haya actualizado. Destaca primero los
 * vencidos (el más antiguo primero) y luego los próximos por fecha ascendente, hasta el tope.
 */
export function resumirSeguimientos(
  vencidos: Pagina<SeguimientoDeLista>,
  programados: Pagina<SeguimientoDeLista>,
  tope: number = TOPE_DESTACADOS,
): ResumenSeguimientos {
  const porEstado = vencidos.data.filter(esVencido);
  const idsPorEstado = new Set(porEstado.map((s) => s.id));
  const vencidosPorFecha = programados.data.filter(
    (s) => s.estado === 'programado' && esVencido(s) && !idsPorEstado.has(s.id),
  );
  const proximos = programados.data.filter((s) => s.estado === 'programado' && !esVencido(s));
  const cantidadVencidosPorFecha = vencidosPorFecha.length;
  const cantidadProximos = proximos.length;
  const destacados = [
    ...[...porEstado, ...vencidosPorFecha].sort(porFecha),
    ...proximos.sort(porFecha),
  ].slice(0, tope);
  return {
    vencidos: vencidos.total + cantidadVencidosPorFecha,
    // Con más programados que la lista pedida, `total` es el dato exacto y el resto un mínimo.
    programados: Math.max(programados.total - cantidadVencidosPorFecha, cantidadProximos),
    parcial: programados.total > programados.data.length,
    destacados,
  };
}
