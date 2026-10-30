import type { ClienteHttp } from '@/shared/api/cliente';
import { http } from '@/shared/api/http';
import type { DonacionRegistrada } from '../types';
import type { DatosDonacion } from '../schemas/donacion';

/**
 * Multipart: `fundacionId`, `tipo`, el campo del tipo elegido (`monto` como texto o
 * `descripcion`) y el `comprobante` opcional. No hay pasarela de pago: solo se registra el aporte.
 */
export function crearDonacion(
  fundacionId: number,
  datos: DatosDonacion,
  cliente: ClienteHttp = http,
): Promise<DonacionRegistrada> {
  const cuerpo = new FormData();
  cuerpo.append('fundacionId', String(fundacionId));
  cuerpo.append('tipo', datos.tipo);
  if (datos.tipo === 'economica') cuerpo.append('monto', datos.monto);
  else cuerpo.append('descripcion', datos.descripcion);
  if (datos.comprobante) cuerpo.append('comprobante', datos.comprobante);
  return cliente.post<DonacionRegistrada>('/donaciones', { cuerpo });
}
