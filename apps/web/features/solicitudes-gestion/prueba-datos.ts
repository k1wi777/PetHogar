import type { DetalleSolicitudRecibida, ResumenSolicitudRecibida } from './types';

/** Datos de ejemplo para las pruebas (no forman parte de la aplicación). */
export function resumen(p: Partial<ResumenSolicitudRecibida> = {}): ResumenSolicitudRecibida {
  return {
    id: 1,
    fechaSolicitud: '2026-11-02',
    estado: 'pendiente',
    mascota: { id: 7, nombre: 'Luna' },
    adoptante: { nombreCompleto: 'Ana Pérez' },
    ...p,
  };
}

export function detalle(p: Partial<DetalleSolicitudRecibida> = {}): DetalleSolicitudRecibida {
  return {
    ...resumen(),
    motivo: 'Tengo patio y tiempo\nsuficiente',
    tipoVivienda: 'casa',
    tieneOtrasMascotas: true,
    observacion: null,
    fechaRespuesta: null,
    adoptante: {
      nombreCompleto: 'Ana Pérez',
      email: 'ana@correo.co',
      telefono: '3001234567',
      ciudad: 'Montería',
    },
    formulario: { url: '/api/fundacion/solicitudes/1/formulario' },
    adopcion: null,
    ...p,
  };
}

export function pagina<T>(
  data: T[],
  extra: { total?: number; page?: number; limit?: number } = {},
) {
  return {
    total: extra.total ?? data.length,
    page: extra.page ?? 1,
    limit: extra.limit ?? 10,
    data,
  };
}
