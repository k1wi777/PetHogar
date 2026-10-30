import type { ClienteHttp } from '@/shared/api/cliente';
import { http } from '@/shared/api/http';
import type {
  ConsultaDonaciones,
  DatosDonacionManual,
  DonacionRegistrada,
  PaginaDonaciones,
} from '../types';

export const DONACIONES_POR_PAGINA = 10;

/** Lista paginada con los totales del periodo y tipo filtrados (misma petición, misma cláusula). */
export function listarDonaciones(
  consulta: ConsultaDonaciones,
  cliente: ClienteHttp = http,
): Promise<PaginaDonaciones> {
  return cliente.get<PaginaDonaciones>('/fundacion/donaciones', {
    consulta: {
      page: consulta.pagina,
      limit: DONACIONES_POR_PAGINA,
      desde: consulta.desde,
      hasta: consulta.hasta,
      tipo: consulta.tipo,
    },
  });
}

/**
 * Multipart: `nombreDonante`, `tipo`, el campo del tipo elegido (`monto` como texto o
 * `descripcion`) y el `comprobante` opcional. Lo que no corresponde al tipo no se envía.
 */
export function registrarDonacionManual(
  datos: DatosDonacionManual,
  cliente: ClienteHttp = http,
): Promise<DonacionRegistrada> {
  const cuerpo = new FormData();
  cuerpo.append('nombreDonante', datos.nombreDonante);
  cuerpo.append('tipo', datos.tipo);
  if (datos.tipo === 'economica') cuerpo.append('monto', datos.monto);
  else cuerpo.append('descripcion', datos.descripcion);
  if (datos.comprobante) cuerpo.append('comprobante', datos.comprobante);
  return cliente.post<DonacionRegistrada>('/fundacion/donaciones', { cuerpo });
}
