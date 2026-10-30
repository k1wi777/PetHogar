import type { ClienteHttp } from '@/shared/api/cliente';
import { http } from '@/shared/api/http';
import type { Pagina } from '@/shared/api/tipos';
import type {
  AdopcionFundacion,
  ConsultaAdopciones,
  DatosCierre,
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

/**
 * Cierra una adopción activa en una sola transacción del backend (adopción, mascota y
 * seguimientos pendientes). El destino de la mascota solo se envía al revocar.
 */
export function cerrarAdopcion(
  adopcionId: number,
  datos: DatosCierre,
  cliente: ClienteHttp = http,
): Promise<AdopcionFundacion> {
  const cuerpo =
    datos.estado === 'revocada'
      ? { estado: datos.estado, motivo: datos.motivo, mascotaDestino: datos.mascotaDestino }
      : { estado: datos.estado, motivo: datos.motivo };
  return cliente.patch<AdopcionFundacion>(`/adopciones/${adopcionId}/estado`, { cuerpo });
}

/** Multipart con el campo `acta`; reemplaza la anterior (solo con la adopción activa). */
export function subirActa(
  adopcionId: number,
  acta: File,
  cliente: ClienteHttp = http,
): Promise<AdopcionFundacion> {
  const cuerpo = new FormData();
  cuerpo.append('acta', acta);
  return cliente.post<AdopcionFundacion>(`/fundacion/adopciones/${adopcionId}/acta`, { cuerpo });
}
