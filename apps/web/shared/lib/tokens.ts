/**
 * Fuente única de los colores del sistema de diseño. `app/globals.css` repite estos
 * valores como variables CSS; una prueba comprueba que ambas copias coincidan.
 */
export const TOKENS_COLOR = {
  background: '#faf8f5',
  foreground: '#1f2933',
  card: '#ffffff',
  'card-foreground': '#1f2933',
  muted: '#efebe4',
  'muted-foreground': '#52606d',
  primary: '#0f6b63',
  'primary-foreground': '#ffffff',
  secondary: '#e3efed',
  'secondary-foreground': '#0b4f49',
  destructive: '#b42318',
  'destructive-foreground': '#ffffff',
  success: '#dcfce7',
  'success-foreground': '#14532d',
  warning: '#fef3c7',
  'warning-foreground': '#7c2d12',
  info: '#dbeafe',
  'info-foreground': '#1e3a8a',
  neutral: '#e5e7eb',
  'neutral-foreground': '#1f2933',
  border: '#7b8794',
  'border-suave': '#d9d3c7',
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
];

/** Elementos no textuales (bordes, foco) que requieren ≥ 3:1; el anillo se separa 2 px del control, por lo que se mide contra el fondo. */
export const PARES_NO_TEXTO: ReadonlyArray<readonly [NombreToken, NombreToken]> = [
  ['border', 'background'],
  ['border', 'card'],
  ['ring', 'background'],
  ['ring', 'card'],
];
