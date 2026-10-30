import type { ClienteHttp } from '@/shared/api/cliente';
import { http } from '@/shared/api/http';
import type {
  ConsultaFundaciones,
  DatosValidacion,
  DetalleFundacion,
  PaginaFundaciones,
} from '../types';

export const FUNDACIONES_POR_PAGINA = 10;

export function listarFundaciones(
  consulta: ConsultaFundaciones,
  cliente: ClienteHttp = http,
): Promise<PaginaFundaciones> {
  return cliente.get<PaginaFundaciones>('/admin/fundaciones', {
    consulta: { estado: consulta.estado, page: consulta.pagina, limit: FUNDACIONES_POR_PAGINA },
  });
}

export function obtenerFundacion(
  id: number,
  cliente: ClienteHttp = http,
): Promise<DetalleFundacion> {
  return cliente.get<DetalleFundacion>(`/admin/fundaciones/${id}`);
}

/** Devuelve el detalle ya actualizado. */
export function decidirValidacion(
  id: number,
  datos: DatosValidacion,
  cliente: ClienteHttp = http,
): Promise<DetalleFundacion> {
  return cliente.patch<DetalleFundacion>(`/admin/fundaciones/${id}/validacion`, { cuerpo: datos });
}
