import type { EstadisticasDto } from './types';

/** Datos de ejemplo para las pruebas (no forman parte de la aplicación). */
export function estadisticas(p: Partial<EstadisticasDto> = {}): EstadisticasDto {
  return {
    filtros: { fundacionId: 1, desde: null, hasta: null },
    adopciones: {
      total: 5,
      porMes: [
        { mes: '2026-10', cantidad: 3 },
        { mes: '2026-09', cantidad: 2 },
      ],
      porEspecie: [
        { especie: 'Gato', cantidad: 2 },
        { especie: 'Perro', cantidad: 3 },
      ],
    },
    solicitudes: {
      total: 7,
      porEstado: { pendiente: 3, aprobada: 2, rechazada: 1, cancelada: 1 },
    },
    seguimientos: {
      total: 6,
      porEstado: { programado: 2, realizado: 3, vencido: 1, cancelado: 0 },
      porBienestar: { bueno: 2, regular: 1, malo: 0 },
    },
    donaciones: {
      total: 4,
      porMes: [
        { mes: '2026-09', cantidad: 1, monto: '9007199254740993.10' },
        { mes: '2026-10', cantidad: 3, monto: '150000.50' },
      ],
      porTipo: {
        economica: { cantidad: 3, monto: '9007199254741093.60' },
        especie: { cantidad: 1 },
      },
    },
    ...p,
  };
}

/** Respuesta del servidor sin ningún dato (rango sin actividad). */
export function estadisticasVacias(): EstadisticasDto {
  return {
    filtros: { fundacionId: 1, desde: '2020-01-01', hasta: '2020-01-31' },
    adopciones: { total: 0, porMes: [], porEspecie: [] },
    solicitudes: { total: 0, porEstado: { pendiente: 0, aprobada: 0, rechazada: 0, cancelada: 0 } },
    seguimientos: {
      total: 0,
      porEstado: { programado: 0, realizado: 0, vencido: 0, cancelado: 0 },
      porBienestar: { bueno: 0, regular: 0, malo: 0 },
    },
    donaciones: {
      total: 0,
      porMes: [],
      porTipo: { economica: { cantidad: 0, monto: '0.00' }, especie: { cantidad: 0 } },
    },
  };
}
