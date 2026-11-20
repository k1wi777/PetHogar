import type { ClienteHttp } from '@/shared/api/cliente';
import { http } from '@/shared/api/http';
import type { Pagina } from '@/shared/api/tipos';
import type { ExtractoEstadisticas, FundacionPorValidar } from '../types';

export const FUNDACIONES_POR_VALIDAR = 5;

export function listarFundacionesPorValidar(
  cliente: ClienteHttp = http,
): Promise<Pagina<FundacionPorValidar>> {
  return cliente.get<Pagina<FundacionPorValidar>>('/admin/fundaciones', {
    consulta: { estado: 'pendiente', limit: FUNDACIONES_POR_VALIDAR },
  });
}

/** Sin rango ni fundación: estadísticas históricas de toda la plataforma. */
export function obtenerExtractoEstadisticas(
  cliente: ClienteHttp = http,
): Promise<ExtractoEstadisticas> {
  return cliente.get<ExtractoEstadisticas>('/admin/estadisticas');
}
