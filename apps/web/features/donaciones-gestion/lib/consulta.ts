import {
  esFechaReal,
  hoyEnBogota,
  primerDiaDelMes,
  restarDias,
  ultimoDiaDelMes,
} from '@/shared/lib/fechas';
import { TIPOS_DONACION, type ConsultaDonaciones, type TipoDonacion } from '../types';

export const RUTA_DONACIONES = '/fundacion/donaciones';
export const RUTA_NUEVA_DONACION = `${RUTA_DONACIONES}/nueva`;

interface Parametros {
  get(nombre: string): string | null;
}

const fechaValida = (v: string | null): string | undefined => (v && esFechaReal(v) ? v : undefined);

/** Filtros y página de la URL; un valor desconocido o inválido se ignora. */
export function leerConsulta(params: Parametros): ConsultaDonaciones {
  const bruto = params.get('pagina');
  const pagina = bruto && /^\d{1,6}$/.test(bruto) ? Number(bruto) : 1;
  const tipo = params.get('tipo');
  let desde = fechaValida(params.get('desde'));
  let hasta = fechaValida(params.get('hasta'));
  // Un periodo invertido en la URL se descarta: el backend lo rechazaría con 400.
  if (desde && hasta && hasta < desde) {
    desde = undefined;
    hasta = undefined;
  }
  return {
    pagina: pagina >= 1 ? pagina : 1,
    desde,
    hasta,
    tipo: TIPOS_DONACION.includes(tipo as TipoDonacion) ? (tipo as TipoDonacion) : undefined,
  };
}

/** `?desde=…&hasta=…&tipo=…&pagina=2`, o cadena vacía con los valores por defecto. */
export function consultaAUrl(consulta: ConsultaDonaciones): string {
  const partes = new URLSearchParams();
  if (consulta.desde) partes.set('desde', consulta.desde);
  if (consulta.hasta) partes.set('hasta', consulta.hasta);
  if (consulta.tipo) partes.set('tipo', consulta.tipo);
  if (consulta.pagina > 1) partes.set('pagina', String(consulta.pagina));
  const texto = partes.toString();
  return texto ? `?${texto}` : '';
}

export type Periodo = { desde?: string; hasta?: string };

/** Atajos de periodo en el calendario de Bogotá, calculados sobre cadenas (sin `Date` local). */
export function periodoEsteMes(hoy: string = hoyEnBogota()): Periodo {
  return { desde: primerDiaDelMes(hoy), hasta: ultimoDiaDelMes(hoy) };
}

export function periodoMesAnterior(hoy: string = hoyEnBogota()): Periodo {
  const ultimo = restarDias(primerDiaDelMes(hoy), 1);
  return { desde: primerDiaDelMes(ultimo), hasta: ultimo };
}

export const PERIODO_TODO: Periodo = {};
