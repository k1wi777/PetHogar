import type { ClienteHttp } from '@/shared/api/cliente';
import { http } from '@/shared/api/http';
import type { Pagina } from '@/shared/api/tipos';
import { rutaDeEnlace } from '@/shared/lib/enlaces';
import type {
  ConsultaSolicitudes,
  DatosDecision,
  DetalleSolicitudRecibida,
  MascotaParaFiltro,
  ResumenSolicitudRecibida,
} from '../types';

export const SOLICITUDES_POR_PAGINA = 10;
/** Máximo de `limit` que acepta el backend en `GET /fundacion/mascotas`. */
export const MASCOTAS_PARA_FILTRO = 100;

export function listarSolicitudesRecibidas(
  consulta: ConsultaSolicitudes,
  limite = SOLICITUDES_POR_PAGINA,
  cliente: ClienteHttp = http,
): Promise<Pagina<ResumenSolicitudRecibida>> {
  return cliente.get<Pagina<ResumenSolicitudRecibida>>('/fundacion/solicitudes', {
    consulta: {
      page: consulta.pagina,
      limit: limite,
      estado: consulta.estado,
      mascotaId: consulta.mascotaId,
    },
  });
}

export function obtenerSolicitudRecibida(id: number, cliente: ClienteHttp = http) {
  return cliente.get<DetalleSolicitudRecibida>(`/fundacion/solicitudes/${id}`);
}

/** Descarga el formulario firmado con la sesión (la ruta sale de la respuesta, nunca de la clave de almacenamiento). */
export function descargarFormulario(url: string, cliente: ClienteHttp = http) {
  return cliente.descargar(rutaDeEnlace(url));
}

/** Aprobar o rechazar: solo viajan los campos de la decisión elegida. */
export function decidirSolicitud(
  id: number,
  datos: DatosDecision,
  cliente: ClienteHttp = http,
): Promise<DetalleSolicitudRecibida> {
  const cuerpo =
    datos.decision === 'aprobar'
      ? {
          decision: datos.decision,
          fechaEntrega: datos.fechaEntrega,
          ...(datos.observacion ? { observacion: datos.observacion } : {}),
        }
      : { decision: datos.decision, observacion: datos.observacion };
  return cliente.patch<DetalleSolicitudRecibida>(`/solicitudes/${id}/decision`, { cuerpo });
}

/** Solo `id` y `nombre`: las 100 más recientes de la fundación (límite del backend). */
export async function listarMascotasParaFiltro(
  cliente: ClienteHttp = http,
): Promise<{ mascotas: MascotaParaFiltro[]; hayMas: boolean }> {
  const pagina = await cliente.get<Pagina<MascotaParaFiltro & Record<string, unknown>>>(
    '/fundacion/mascotas',
    { consulta: { page: 1, limit: MASCOTAS_PARA_FILTRO } },
  );
  return {
    mascotas: pagina.data.map(({ id, nombre }) => ({ id, nombre })),
    hayMas: pagina.total > pagina.data.length,
  };
}
