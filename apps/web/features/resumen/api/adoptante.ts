import type { ClienteHttp } from '@/shared/api/cliente';
import { http } from '@/shared/api/http';
import type { Pagina } from '@/shared/api/tipos';
import type { ResumenAdopcion, ResumenSolicitud, SeguimientoDeLista } from '../types';

export const RECIENTES = 3;
/** Máximo de `limit` que acepta la API; acota el cálculo de seguimientos por fecha (D3). */
export const LIMITE_MAXIMO = 100;
export const VENCIDOS_DESTACADOS = 5;

export function listarMisSolicitudes(
  consulta: { estado?: 'pendiente'; limite: number },
  cliente: ClienteHttp = http,
): Promise<Pagina<ResumenSolicitud>> {
  return cliente.get<Pagina<ResumenSolicitud>>('/mis-solicitudes', {
    consulta: { estado: consulta.estado, limit: consulta.limite },
  });
}

export function listarMisAdopcionesActivas(
  cliente: ClienteHttp = http,
): Promise<Pagina<ResumenAdopcion>> {
  return cliente.get<Pagina<ResumenAdopcion>>('/mis-adopciones', {
    consulta: { estado: 'activa', limit: RECIENTES },
  });
}

export function listarMisSeguimientos(
  estado: 'programado' | 'vencido',
  cliente: ClienteHttp = http,
): Promise<Pagina<SeguimientoDeLista>> {
  return cliente.get<Pagina<SeguimientoDeLista>>('/mis-seguimientos', {
    consulta: { estado, limit: estado === 'programado' ? LIMITE_MAXIMO : VENCIDOS_DESTACADOS },
  });
}
