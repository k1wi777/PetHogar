import type { AdopcionFundacion, DetalleSeguimientoFundacion, ResumenSeguimiento } from './types';

/** Datos de ejemplo para las pruebas (no forman parte de la aplicación). */
export function seguimiento(p: Partial<ResumenSeguimiento> = {}): ResumenSeguimiento {
  return {
    id: 1,
    tipo: 'visita',
    fechaProgramada: '2026-12-15',
    fechaRealizada: null,
    estado: 'programado',
    vencido: false,
    ...p,
  };
}

export function adopcion(p: Partial<AdopcionFundacion> = {}): AdopcionFundacion {
  return {
    id: 1,
    fechaEntrega: '2026-11-20',
    estado: 'activa',
    solicitudId: 4,
    mascota: { id: 7, nombre: 'Luna' },
    motivoCierre: null,
    fechaCierre: null,
    acta: null,
    adoptante: {
      nombreCompleto: 'Ana Pérez',
      email: 'ana@correo.co',
      telefono: '3001234567',
      ciudad: 'Montería',
    },
    seguimientos: [seguimiento()],
    ...p,
  };
}

export function detalleSeguimiento(
  p: Partial<DetalleSeguimientoFundacion> = {},
): DetalleSeguimientoFundacion {
  return {
    ...seguimiento(),
    adopcionId: 1,
    tieneReporte: false,
    mascota: { id: 7, nombre: 'Luna' },
    adoptante: { nombreCompleto: 'Ana Pérez' },
    fechaEntrega: '2020-01-01',
    estadoBienestar: null,
    observaciones: null,
    reporte: null,
    evidencias: [],
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
