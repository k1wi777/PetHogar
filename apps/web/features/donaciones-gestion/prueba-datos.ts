import type { DonacionFundacion, PaginaDonaciones, TotalesDonaciones } from './types';

/** Datos de ejemplo para las pruebas (no forman parte de la aplicación). */
export function donacion(p: Partial<DonacionFundacion> = {}): DonacionFundacion {
  return {
    id: 1,
    tipo: 'economica',
    monto: '50000.50',
    descripcionEspecie: null,
    fecha: '2026-11-03T20:30:00.000Z',
    donante: { nombre: 'María Gómez', origen: 'manual' },
    comprobante: null,
    ...p,
  };
}

export function totales(p: Partial<TotalesDonaciones> = {}): TotalesDonaciones {
  return { economica: { cantidad: 2, monto: '150000.50' }, especie: { cantidad: 1 }, ...p };
}

export function pagina(
  data: DonacionFundacion[],
  extra: Partial<PaginaDonaciones> = {},
): PaginaDonaciones {
  return {
    total: extra.total ?? data.length,
    page: extra.page ?? 1,
    limit: extra.limit ?? 10,
    data,
    totales: extra.totales ?? totales(),
  };
}
