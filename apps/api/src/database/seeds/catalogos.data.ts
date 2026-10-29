export const ROLES = ['administrador', 'fundacion', 'adoptante'] as const;

/** Especies y razas base; datos de ejemplo que el administrador puede ampliar (B-18). */
export const RAZAS_POR_ESPECIE: Record<string, string[]> = {
  perro: [
    'Mestizo',
    'Labrador',
    'Pastor Alemán',
    'Criollo',
    'Golden Retriever',
    'Chihuahua',
    'Pug',
    'Schnauzer',
    'Pitbull',
  ],
  gato: ['Mestizo', 'Siamés', 'Persa', 'Angora', 'Criollo'],
};
