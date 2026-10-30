import type { ClienteHttp } from '@/shared/api/cliente';
import { http } from '@/shared/api/http';
import type { Pagina } from '@/shared/api/tipos';
import type {
  CambiosMascota,
  ConsultaMascotas,
  DatosMascota,
  MascotaGestion,
  MascotaGestionDetalle,
} from '../types';

export const MASCOTAS_POR_PAGINA = 10;

export function listarMisMascotas(
  consulta: ConsultaMascotas,
  cliente: ClienteHttp = http,
): Promise<Pagina<MascotaGestion>> {
  return cliente.get<Pagina<MascotaGestion>>('/fundacion/mascotas', {
    consulta: { page: consulta.pagina, limit: MASCOTAS_POR_PAGINA, estado: consulta.estado },
  });
}

export function obtenerMascotaGestion(
  id: number,
  cliente: ClienteHttp = http,
): Promise<MascotaGestionDetalle> {
  return cliente.get<MascotaGestionDetalle>(`/fundacion/mascotas/${id}`);
}

export function crearMascota(
  datos: DatosMascota,
  cliente: ClienteHttp = http,
): Promise<MascotaGestion> {
  return cliente.post<MascotaGestion>('/mascotas', { cuerpo: datos });
}

export function editarMascota(
  id: number,
  cambios: CambiosMascota,
  cliente: ClienteHttp = http,
): Promise<MascotaGestion> {
  return cliente.patch<MascotaGestion>(`/mascotas/${id}`, { cuerpo: cambios });
}

/** Solo desde `disponible`; el cuerpo va vacío. */
export function darDeBaja(id: number, cliente: ClienteHttp = http): Promise<MascotaGestion> {
  return cliente.patch<MascotaGestion>(`/mascotas/${id}/baja`);
}
