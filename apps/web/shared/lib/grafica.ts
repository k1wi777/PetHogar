import { TOKENS_COLOR } from './tokens';

/** Patrón SVG que acompaña a cada color: la serie nunca se distingue solo por el color. */
export type PatronGrafica = 'solido' | 'rayas' | 'puntos' | 'cuadricula' | 'diagonal';

export interface EstiloSerie {
  color: string;
  patron: PatronGrafica;
}

/**
 * Paleta de las gráficas (hasta 5 series o rebanadas, asignadas en orden). Todos los colores
 * superan 3:1 contra `card` (fondo de la gráfica); las etiquetas con valor van en `foreground`
 * (≥ 4.5:1). Una prueba lo comprueba con `contraste.ts`.
 */
export const PALETA_GRAFICA: ReadonlyArray<EstiloSerie> = [
  { color: '#0f6b63', patron: 'solido' },
  { color: '#334155', patron: 'rayas' },
  { color: '#92400e', patron: 'puntos' },
  { color: '#1d4ed8', patron: 'cuadricula' },
  { color: '#78716c', patron: 'diagonal' },
];

/** Fondo de la gráfica y de la separación entre rebanadas adyacentes. */
export const COLOR_FONDO_GRAFICA = TOKENS_COLOR.card;

/** Separación entre rebanadas: separa las adyacentes aunque su contraste mutuo sea menor de 3:1. */
export const SEPARACION_REBANADAS_PX = 2;

/** Color de las líneas de los patrones sobre el color de relleno. */
export const COLOR_TRAZO_PATRON = '#ffffff';

/** Opacidad con la que se dibuja el trazo del patrón (la usa `PatronesGrafica`). */
export const OPACIDAD_TRAZO_PATRON = 0.7;

export function estiloDeSerie(indice: number): EstiloSerie {
  return PALETA_GRAFICA[indice % PALETA_GRAFICA.length]!;
}
