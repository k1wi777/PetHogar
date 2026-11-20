import type { Pagina } from '@/shared/api/tipos';
import type { SeguimientoDeLista } from './types';

/** Datos de ejemplo para las pruebas (no forman parte de la aplicación). */
export function paginaDe<T>(data: T[], total = data.length): Pagina<T> {
  return { data, total, page: 1, limit: 100 };
}

export function seguimientoDe(p: Partial<SeguimientoDeLista> & { id: number }): SeguimientoDeLista {
  return {
    tipo: 'visita',
    fechaProgramada: '2026-12-01',
    estado: 'programado',
    vencido: false,
    mascota: { id: 1, nombre: 'Luna' },
    ...p,
  };
}
