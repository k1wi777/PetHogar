/**
 * Fuente única de los colores del sistema de diseño. `app/globals.css` repite estos
 * valores como variables CSS; una prueba comprueba que ambas copias coincidan.
 */
export const TOKENS_COLOR = {
  background: '#fffbf9',
  foreground: '#2d1b2e',
  card: '#ffffff',
  'card-foreground': '#2d1b2e',
  muted: '#f6ebf0',
  'muted-foreground': '#675064',
  primary: '#86246a',
  'primary-foreground': '#ffffff',
  secondary: '#fbe3ef',
  'secondary-foreground': '#6a1a53',
  acento: '#ffc23d',
  'acento-foreground': '#2d1b2e',
  destructive: '#b42318',
  'destructive-foreground': '#ffffff',
  success: '#dcfce7',
  'success-foreground': '#14532d',
  warning: '#fef3c7',
  'warning-foreground': '#7c2d12',
  info: '#dbeafe',
  'info-foreground': '#1e3a8a',
  neutral: '#e5e7eb',
  'neutral-foreground': '#2d1b2e',
  border: '#8d7388',
  'border-suave': '#ead9e2',
  ring: '#1d4ed8',
} as const;

export type NombreToken = keyof typeof TOKENS_COLOR;

/** Pares texto/fondo que se usan en la interfaz y deben cumplir WCAG 2.1 AA. */
export const PARES_TEXTO: ReadonlyArray<readonly [NombreToken, NombreToken]> = [
  ['foreground', 'background'],
  ['foreground', 'card'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['muted-foreground', 'muted'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['destructive-foreground', 'destructive'],
  ['success-foreground', 'success'],
  ['warning-foreground', 'warning'],
  ['info-foreground', 'info'],
  ['neutral-foreground', 'neutral'],
  ['primary', 'background'],
  ['primary', 'card'],
  ['destructive', 'background'],
  ['destructive', 'card'],
  ['acento-foreground', 'acento'],
  ['primary', 'acento'],
  ['primary', 'secondary'],
  // Estados al pasar el puntero (botones) y opciones elegidas.
  ['primary-foreground', 'secondary-foreground'],
  ['foreground', 'muted'],
  ['muted-foreground', 'secondary'],
];

/** Elementos no textuales (bordes, foco) que requieren ≥ 3:1; el anillo se separa 2 px del control, por lo que se mide contra el fondo. */
export const PARES_NO_TEXTO: ReadonlyArray<readonly [NombreToken, NombreToken]> = [
  ['border', 'background'],
  ['border', 'card'],
  ['ring', 'background'],
  ['ring', 'card'],
  ['ring', 'acento'],
  // Borde de control sobre mango: `border` no llega a 3:1 ahí.
  ['primary', 'acento'],
];
