import type { Notificacion } from './types';

/** Datos de ejemplo para las pruebas (no forman parte de la aplicación). */
export function notificacion(p: Partial<Notificacion> = {}): Notificacion {
  return {
    id: 1,
    tipo: 'solicitud',
    titulo: 'Solicitud aprobada',
    mensaje: 'Tu solicitud para adoptar a Luna fue aprobada.',
    leida: false,
    fechaCreacion: '2026-10-30T15:00:00.000Z',
    referencia: { tipo: 'solicitud', id: 4 },
    ...p,
  };
}

export function paginaDe(
  data: Notificacion[],
  p: { total?: number; page?: number; limit?: number } = {},
) {
  return { data, total: p.total ?? data.length, page: p.page ?? 1, limit: p.limit ?? 10 };
}
