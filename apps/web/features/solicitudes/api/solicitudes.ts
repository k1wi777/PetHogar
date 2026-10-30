import type { ClienteHttp } from '@/shared/api/cliente';
import { http } from '@/shared/api/http';
import type { Pagina } from '@/shared/api/tipos';
import type {
  ConsultaSolicitudes,
  DetalleSolicitud,
  ResumenSolicitud,
  TipoVivienda,
} from '../types';

export const SOLICITUDES_POR_PAGINA = 10;

export interface DatosEnvio {
  mascotaId: number;
  motivo: string;
  tipoVivienda: TipoVivienda;
  tieneOtrasMascotas: boolean;
  formulario: File;
}

/** Multipart: los campos van como texto («true» o «false») y el archivo en `formulario`. */
export function crearSolicitud(
  datos: DatosEnvio,
  cliente: ClienteHttp = http,
): Promise<DetalleSolicitud> {
  const cuerpo = new FormData();
  cuerpo.append('mascotaId', String(datos.mascotaId));
  cuerpo.append('motivo', datos.motivo);
  cuerpo.append('tipoVivienda', datos.tipoVivienda);
  cuerpo.append('tieneOtrasMascotas', datos.tieneOtrasMascotas ? 'true' : 'false');
  cuerpo.append('formulario', datos.formulario);
  return cliente.post<DetalleSolicitud>('/solicitudes', { cuerpo });
}

export function listarMisSolicitudes(
  consulta: ConsultaSolicitudes,
  cliente: ClienteHttp = http,
): Promise<Pagina<ResumenSolicitud>> {
  return cliente.get<Pagina<ResumenSolicitud>>('/mis-solicitudes', {
    consulta: { page: consulta.pagina, limit: SOLICITUDES_POR_PAGINA, estado: consulta.estado },
  });
}

export function obtenerMiSolicitud(id: number, cliente: ClienteHttp = http) {
  return cliente.get<DetalleSolicitud>(`/mis-solicitudes/${id}`);
}

export function cancelarSolicitud(id: number, cliente: ClienteHttp = http) {
  return cliente.patch<DetalleSolicitud>(`/solicitudes/${id}/cancelar`);
}
