import type { ClienteHttp } from '@/shared/api/cliente';
import { esErrorApi } from '@/shared/api/errores';
import { http } from '@/shared/api/http';
import type { MascotaParaSolicitar } from '../types';

/** Ficha pública mínima. `null` si no existe o no está disponible (404/400): es la pantalla «no disponible». */
export async function obtenerMascotaParaSolicitar(
  id: number,
  cliente: ClienteHttp = http,
): Promise<MascotaParaSolicitar | null> {
  try {
    return await cliente.get<MascotaParaSolicitar>(`/mascotas/${id}`, { autenticada: false });
  } catch (error) {
    if (esErrorApi(error) && (error.estado === 404 || error.estado === 400)) return null;
    throw error;
  }
}
