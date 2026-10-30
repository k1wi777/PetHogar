import type { ClienteHttp } from '@/shared/api/cliente';
import { http } from '@/shared/api/http';
import type { DatosHistorial, EventoMedico } from '../types';

/**
 * No existe un GET de gestión: la lista pública solo sirve mascotas `disponible` (404 en otro caso),
 * por eso se consulta únicamente en ese estado.
 */
export function listarHistorialPublico(
  mascotaId: number,
  cliente: ClienteHttp = http,
): Promise<EventoMedico[]> {
  return cliente.get<EventoMedico[]>(`/mascotas/${mascotaId}/historial`, { autenticada: false });
}

export function registrarEvento(
  mascotaId: number,
  datos: DatosHistorial,
  cliente: ClienteHttp = http,
): Promise<EventoMedico> {
  return cliente.post<EventoMedico>(`/mascotas/${mascotaId}/historial`, { cuerpo: datos });
}
