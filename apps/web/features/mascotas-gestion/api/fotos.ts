import type { ClienteHttp } from '@/shared/api/cliente';
import { http } from '@/shared/api/http';
import type { FotoGestion } from '../types';

/** Multipart: una foto por petición, en el campo `foto`. */
export function subirFoto(
  mascotaId: number,
  archivo: File,
  cliente: ClienteHttp = http,
): Promise<FotoGestion> {
  const cuerpo = new FormData();
  cuerpo.append('foto', archivo);
  return cliente.post<FotoGestion>(`/mascotas/${mascotaId}/fotos`, { cuerpo });
}

/** Devuelve la galería completa y actualizada. */
export function marcarPrincipal(
  mascotaId: number,
  fotoId: number,
  cliente: ClienteHttp = http,
): Promise<FotoGestion[]> {
  return cliente.patch<FotoGestion[]>(`/mascotas/${mascotaId}/fotos/${fotoId}/principal`);
}

/** 204: el servidor promueve otra foto si se borró la principal, así que hay que releer el detalle. */
export function eliminarFoto(
  mascotaId: number,
  fotoId: number,
  cliente: ClienteHttp = http,
): Promise<void> {
  return cliente.delete<void>(`/mascotas/${mascotaId}/fotos/${fotoId}`);
}
