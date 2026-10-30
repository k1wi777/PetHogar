import { esErrorApi } from '@/shared/api/errores';
import { clienteServidor } from '@/shared/api/servidor';
import type { ClienteHttp } from '@/shared/api/cliente';
import type { Pagina } from '@/shared/api/tipos';
import type { ConsultaCatalogo, FichaMascota, MascotaCatalogo } from '../types';

/** Catálogo público (`GET /mascotas`). Los errores de red, 429 y 5xx se propagan al `error.tsx`. */
export function listarMascotas(
  consulta: ConsultaCatalogo,
  cliente: ClienteHttp = clienteServidor(),
): Promise<Pagina<MascotaCatalogo>> {
  return cliente.get<Pagina<MascotaCatalogo>>('/mascotas', {
    autenticada: false,
    consulta: { ...consulta },
  });
}

/** Ficha pública. Devuelve `null` si no existe, no está disponible o el id no es válido (404/400). */
export async function obtenerFicha(
  id: string,
  cliente: ClienteHttp = clienteServidor(),
): Promise<FichaMascota | null> {
  if (!/^\d{1,10}$/.test(id)) return null;
  try {
    return await cliente.get<FichaMascota>(`/mascotas/${id}`, { autenticada: false });
  } catch (error) {
    if (esErrorApi(error) && (error.estado === 404 || error.estado === 400)) return null;
    throw error;
  }
}
