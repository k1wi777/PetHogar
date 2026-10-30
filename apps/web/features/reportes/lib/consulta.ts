import {
  esFechaReal,
  hoyEnBogota,
  primerDiaDelMes,
  restarDias,
  ultimoDiaDelMes,
} from '@/shared/lib/fechas';
import {
  TIPOS_REPORTE,
  type ConsultaEstadisticas,
  type ConsultaReportes,
  type TipoReporte,
} from '../types';

export const REPORTE_POR_DEFECTO: TipoReporte = 'adopciones';

interface Parametros {
  get(nombre: string): string | null;
}

const fechaValida = (v: string | null): string | undefined => (v && esFechaReal(v) ? v : undefined);

/** Reporte, rango y fundación de la URL; un valor desconocido o inválido se ignora. */
export function leerConsulta(params: Parametros): ConsultaReportes {
  const reporte = params.get('reporte');
  let desde = fechaValida(params.get('desde'));
  let hasta = fechaValida(params.get('hasta'));
  // Un rango invertido en la URL se descarta: el backend lo rechazaría con 400.
  if (desde && hasta && hasta < desde) {
    desde = undefined;
    hasta = undefined;
  }
  const bruto = params.get('fundacion');
  const fundacion = bruto && /^\d{1,10}$/.test(bruto) ? Number(bruto) : 0;
  return {
    reporte: TIPOS_REPORTE.includes(reporte as TipoReporte)
      ? (reporte as TipoReporte)
      : REPORTE_POR_DEFECTO,
    desde,
    hasta,
    fundacion: fundacion > 0 ? fundacion : undefined,
  };
}

/** `?reporte=…&desde=…&hasta=…&fundacion=…`, o cadena vacía con los valores por defecto. */
export function consultaAUrl(consulta: ConsultaReportes): string {
  const partes = new URLSearchParams();
  if (consulta.reporte !== REPORTE_POR_DEFECTO) partes.set('reporte', consulta.reporte);
  if (consulta.desde) partes.set('desde', consulta.desde);
  if (consulta.hasta) partes.set('hasta', consulta.hasta);
  if (consulta.fundacion) partes.set('fundacion', String(consulta.fundacion));
  const texto = partes.toString();
  return texto ? `?${texto}` : '';
}

/** Lo que viaja al servidor: el tipo de reporte es solo de la pantalla y la fundación solo del administrador. */
export function aConsultaEstadisticas(
  consulta: ConsultaReportes,
  ambito: 'fundacion' | 'administrador',
): ConsultaEstadisticas {
  return {
    desde: consulta.desde,
    hasta: consulta.hasta,
    fundacionId: ambito === 'administrador' ? consulta.fundacion : undefined,
  };
}

export type Periodo = { desde?: string; hasta?: string };

/** Atajos de rango en el calendario de Bogotá, calculados sobre cadenas (sin `Date` local). */
export function periodoEsteMes(hoy: string = hoyEnBogota()): Periodo {
  return { desde: primerDiaDelMes(hoy), hasta: ultimoDiaDelMes(hoy) };
}

export function periodoMesAnterior(hoy: string = hoyEnBogota()): Periodo {
  const ultimo = restarDias(primerDiaDelMes(hoy), 1);
  return { desde: primerDiaDelMes(ultimo), hasta: ultimo };
}

export const PERIODO_TODO: Periodo = {};
