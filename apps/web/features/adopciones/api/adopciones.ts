import type { ClienteHttp } from '@/shared/api/cliente';
import { http } from '@/shared/api/http';
import type { Pagina } from '@/shared/api/tipos';
import type { AdopcionAdoptante, DetalleSeguimiento } from '../types';

export const ADOPCIONES_POR_PAGINA = 10;

export function listarMisAdopciones(
  pagina: number,
  cliente: ClienteHttp = http,
): Promise<Pagina<AdopcionAdoptante>> {
  return cliente.get<Pagina<AdopcionAdoptante>>('/mis-adopciones', {
    consulta: { page: pagina, limit: ADOPCIONES_POR_PAGINA },
  });
}

export function obtenerMiSeguimiento(
  id: number,
  cliente: ClienteHttp = http,
): Promise<DetalleSeguimiento> {
  return cliente.get<DetalleSeguimiento>(`/mis-seguimientos/${id}`);
}

/** Multipart: `comentarios` como texto y cada foto repetida en `fotos`. */
export function enviarReporte(
  id: number,
  datos: { comentarios: string; fotos: File[] },
  cliente: ClienteHttp = http,
): Promise<DetalleSeguimiento> {
  const cuerpo = new FormData();
  cuerpo.append('comentarios', datos.comentarios);
  for (const foto of datos.fotos) cuerpo.append('fotos', foto);
  return cliente.post<DetalleSeguimiento>(`/seguimientos/${id}/reporte`, { cuerpo });
}
