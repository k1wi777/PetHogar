import type { DetalleFundacion, PaginaFundaciones, ResumenFundacion } from './types';

/** Datos de ejemplo para las pruebas (no forman parte de la aplicación). */
export function resumen(p: Partial<ResumenFundacion> = {}): ResumenFundacion {
  return {
    id: 1,
    nombre: 'Patitas Felices',
    nit: '900123456-7',
    ciudad: 'Montería',
    estadoValidacion: 'pendiente',
    fechaValidacion: null,
    ...p,
  };
}

export function detalle(p: Partial<DetalleFundacion> = {}): DetalleFundacion {
  return {
    ...resumen(),
    direccion: 'Calle 10 # 5-20',
    descripcion: 'Rescatamos perros y gatos.',
    observacionValidacion: null,
    contacto: { email: 'patitas@correo.co', telefono: '3001234567' },
    documento: { url: '/api/admin/fundaciones/1/documento' },
    ...p,
  };
}

export function pagina(
  data: ResumenFundacion[],
  extra: Partial<PaginaFundaciones> = {},
): PaginaFundaciones {
  return {
    data,
    total: extra.total ?? data.length,
    page: extra.page ?? 1,
    limit: extra.limit ?? 10,
  };
}
