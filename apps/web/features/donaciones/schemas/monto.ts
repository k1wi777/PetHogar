/** Espejo de `monto.ts` y `donaciones.constants.ts` del backend: mismos tope, formato y textos. */
export const MONTO_MAXIMO = '1000000000';
export const MENSAJE_FORMATO_MONTO = 'Usa solo números y punto decimal, hasta 2 decimales';
export const MENSAJE_MONTO_MAYOR_A_CERO = 'El monto debe ser mayor que 0';
export const MENSAJE_MONTO_MAXIMO = 'El monto no puede superar $ 1.000.000.000';
export const MENSAJE_MONTO_OBLIGATORIO = 'Indica el monto de la donación económica';

const FORMATO = /^(\d{1,30})(?:\.(\d{1,2}))?$/;
const TOPE_CENTAVOS = BigInt(MONTO_MAXIMO) * 100n;

export type ProblemaMonto = 'formato' | 'cero' | 'maximo';

/** Se acepta la coma decimal («5,5») y se normaliza a punto; sin separadores de miles. */
export function normalizarMonto(texto: string): string {
  return texto.trim().replace(',', '.');
}

/** Comparación en centavos con `BigInt`: el monto nunca pasa por `Number`. */
export function problemaDeMonto(monto: string): ProblemaMonto | null {
  const m = FORMATO.exec(monto);
  if (!m) return 'formato';
  const centavos = BigInt(m[1]!) * 100n + BigInt((m[2] ?? '').padEnd(2, '0'));
  if (centavos === 0n) return 'cero';
  if (centavos > TOPE_CENTAVOS) return 'maximo';
  return null;
}

export function mensajeDeProblema(p: ProblemaMonto): string {
  if (p === 'cero') return MENSAJE_MONTO_MAYOR_A_CERO;
  if (p === 'maximo') return MENSAJE_MONTO_MAXIMO;
  return MENSAJE_FORMATO_MONTO;
}

/** «$ 50.000» o «$ 50.000,50» solo para mostrar; el valor enviado es la cadena escrita. */
export function formatearMonto(monto: string): string {
  const [entero = '0', decimales] = monto.split('.');
  const miles = entero.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$ ${miles}${decimales && /[1-9]/.test(decimales) ? `,${decimales.padEnd(2, '0')}` : ''}`;
}
