import type { DetalleSolicitud, MascotaParaSolicitar, ResumenSolicitud } from './types';

/** Datos de ejemplo para las pruebas (no forman parte de la aplicación). */
export const MASCOTA: MascotaParaSolicitar = {
  id: 7,
  nombre: 'Luna',
  fundacion: { id: 3, nombre: 'Patitas', ciudad: 'Montería' },
};

export function resumen(parcial: Partial<ResumenSolicitud> = {}): ResumenSolicitud {
  return {
    id: 1,
    fechaSolicitud: '2026-10-20T15:00:00.000Z',
    estado: 'pendiente',
    mascota: { id: 7, nombre: 'Luna' },
    fundacion: { nombre: 'Patitas' },
    ...parcial,
  };
}

export function detalle(parcial: Partial<DetalleSolicitud> = {}): DetalleSolicitud {
  return {
    ...resumen(),
    motivo: 'Tengo patio y tiempo',
    tipoVivienda: 'casa',
    tieneOtrasMascotas: false,
    observacion: null,
    fechaRespuesta: null,
    formulario: { url: '/api/mis-solicitudes/1/formulario' },
    ...parcial,
  };
}
