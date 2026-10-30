import type { ClienteHttp } from '@/shared/api/cliente';
import { http } from '@/shared/api/http';
import type { Pagina } from '@/shared/api/tipos';
import type { ConsultaNotificaciones, Notificacion } from '../types';

export const NOTIFICACIONES_POR_PAGINA = 10;
export const NOTIFICACIONES_RECIENTES = 5;

const LEIDA_DE_FILTRO = { todas: undefined, 'no-leidas': false, leidas: true } as const;

export function listarNotificaciones(
  consulta: ConsultaNotificaciones,
  limite: number = NOTIFICACIONES_POR_PAGINA,
  cliente: ClienteHttp = http,
): Promise<Pagina<Notificacion>> {
  return cliente.get<Pagina<Notificacion>>('/notificaciones', {
    consulta: { page: consulta.pagina, limit: limite, leida: LEIDA_DE_FILTRO[consulta.filtro] },
  });
}

export function marcarLeida(id: number, cliente: ClienteHttp = http): Promise<Notificacion> {
  return cliente.patch<Notificacion>(`/notificaciones/${id}/leida`);
}

export function leerTodas(cliente: ClienteHttp = http): Promise<{ actualizadas: number }> {
  return cliente.patch<{ actualizadas: number }>('/notificaciones/leer-todas');
}
