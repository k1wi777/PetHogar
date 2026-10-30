import type { AdopcionAdoptante, DetalleSeguimiento, ResumenSeguimiento } from './types';

/** Datos de ejemplo para las pruebas (no forman parte de la aplicación). */
export function seguimiento(p: Partial<ResumenSeguimiento> = {}): ResumenSeguimiento {
  return {
    id: 1,
    tipo: 'reporte',
    fechaProgramada: '2026-12-15',
    fechaRealizada: null,
    estado: 'programado',
    vencido: false,
    ...p,
  };
}

export function adopcion(p: Partial<AdopcionAdoptante> = {}): AdopcionAdoptante {
  return {
    id: 1,
    fechaEntrega: '2026-11-20',
    estado: 'activa',
    solicitudId: 4,
    mascota: { id: 7, nombre: 'Luna' },
    fundacion: { nombre: 'Patitas', ciudad: 'Montería' },
    motivoCierre: null,
    fechaCierre: null,
    acta: null,
    seguimientos: [seguimiento()],
    ...p,
  };
}

export function detalleSeguimiento(p: Partial<DetalleSeguimiento> = {}): DetalleSeguimiento {
  return {
    ...seguimiento(),
    adopcionId: 1,
    tieneReporte: false,
    mascota: { id: 7, nombre: 'Luna' },
    fundacion: { nombre: 'Patitas' },
    fechaEntrega: '2026-11-20',
    reporte: null,
    ...p,
  };
}
