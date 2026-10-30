import type { ClienteHttp } from '@/shared/api/cliente';
import { http } from '@/shared/api/http';
import type { Pagina } from '@/shared/api/tipos';
import type {
  AdopcionFundacion,
  ConsultaAdopciones,
  DatosProgramar,
  DatosResultado,
  DetalleSeguimientoFundacion,
} from '../types';

export const ADOPCIONES_POR_PAGINA = 10;

export function listarAdopciones(
  consulta: ConsultaAdopciones,
  cliente: ClienteHttp = http,
): Promise<Pagina<AdopcionFundacion>> {
  return cliente.get<Pagina<AdopcionFundacion>>('/fundacion/adopciones', {
    consulta: { page: consulta.pagina, limit: ADOPCIONES_POR_PAGINA, estado: consulta.estado },
  });
}

export function programarSeguimiento(
  adopcionId: number,
  datos: DatosProgramar,
  cliente: ClienteHttp = http,
): Promise<DetalleSeguimientoFundacion> {
  return cliente.post<DetalleSeguimientoFundacion>(`/adopciones/${adopcionId}/seguimientos`, {
    cuerpo: { tipo: datos.tipo, fechaProgramada: datos.fechaProgramada },
  });
}

export function obtenerSeguimiento(
  id: number,
  cliente: ClienteHttp = http,
): Promise<DetalleSeguimientoFundacion> {
  return cliente.get<DetalleSeguimientoFundacion>(`/fundacion/seguimientos/${id}`);
}

/** Multipart: campos como texto y cada evidencia repetida en `evidencias`. */
export function registrarResultado(
  id: number,
  datos: DatosResultado,
  cliente: ClienteHttp = http,
): Promise<DetalleSeguimientoFundacion> {
  const cuerpo = new FormData();
  cuerpo.append('fechaRealizada', datos.fechaRealizada);
  cuerpo.append('estadoBienestar', datos.estadoBienestar);
  cuerpo.append('observaciones', datos.observaciones);
  for (const evidencia of datos.evidencias) cuerpo.append('evidencias', evidencia);
  return cliente.patch<DetalleSeguimientoFundacion>(`/seguimientos/${id}/resultado`, { cuerpo });
}
