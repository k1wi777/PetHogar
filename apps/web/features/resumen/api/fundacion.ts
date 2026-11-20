import type { ClienteHttp } from '@/shared/api/cliente';
import { http } from '@/shared/api/http';
import type { Pagina } from '@/shared/api/tipos';
import type {
  EstadoMascota,
  PaginaDonacionesMes,
  ResumenSolicitudRecibida,
  SeguimientoDeLista,
} from '../types';
import { LIMITE_MAXIMO, RECIENTES, VENCIDOS_DESTACADOS } from './adoptante';

/** Solo el `total` importa: con `limit=1` el conteo es exacto sin traer la lista. */
export function contarMascotas(
  estado: EstadoMascota,
  cliente: ClienteHttp = http,
): Promise<Pagina<{ id: number }>> {
  return cliente.get<Pagina<{ id: number }>>('/fundacion/mascotas', {
    consulta: { estado, limit: 1 },
  });
}

export function listarSolicitudesPendientes(
  cliente: ClienteHttp = http,
): Promise<Pagina<ResumenSolicitudRecibida>> {
  return cliente.get<Pagina<ResumenSolicitudRecibida>>('/fundacion/solicitudes', {
    consulta: { estado: 'pendiente', limit: RECIENTES },
  });
}

export function listarSeguimientosFundacion(
  estado: 'programado' | 'vencido',
  cliente: ClienteHttp = http,
): Promise<Pagina<SeguimientoDeLista>> {
  return cliente.get<Pagina<SeguimientoDeLista>>('/fundacion/seguimientos', {
    consulta: { estado, limit: estado === 'programado' ? LIMITE_MAXIMO : VENCIDOS_DESTACADOS },
  });
}

export function listarDonacionesDelMes(
  rango: { desde: string; hasta: string },
  cliente: ClienteHttp = http,
): Promise<PaginaDonacionesMes> {
  return cliente.get<PaginaDonacionesMes>('/fundacion/donaciones', {
    consulta: { desde: rango.desde, hasta: rango.hasta, limit: RECIENTES },
  });
}
