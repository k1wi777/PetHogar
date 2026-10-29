import { MONTO_MAXIMO } from './donaciones.constants';

/** `ddd` o `ddd.dd`, sin signo ni exponente (hasta 2 decimales); el tope lo comprueba `bigint`. */
const FORMATO = /^(\d{1,30})(?:\.(\d{1,2}))?$/;

export type ProblemaMonto = 'formato' | 'cero' | 'maximo';

/**
 * Céntimos exactos como `bigint`: el monto es una cadena y NUNCA pasa por `Number`, así que no hay
 * errores de punto flotante al comparar ni al sumar.
 */
function centavos(monto: string): bigint | null {
  const partes = FORMATO.exec(monto);
  if (!partes) return null;
  const decimales = (partes[2] ?? '').padEnd(2, '0');
  return BigInt(partes[1]) * 100n + BigInt(decimales);
}

const TOPE_CENTAVOS = BigInt(MONTO_MAXIMO) * 100n;

export function problemaDeMonto(monto: string): ProblemaMonto | null {
  const valor = centavos(monto);
  if (valor === null) return 'formato';
  if (valor === 0n) return 'cero';
  if (valor > TOPE_CENTAVOS) return 'maximo';
  return null;
}

/** `"5"` → `"5.00"`, `"007.5"` → `"7.50"`. Solo para montos que ya pasaron `problemaDeMonto`. */
export function normalizarMonto(monto: string): string {
  const valor = centavos(monto);
  if (valor === null) throw new Error('Monto con formato inválido');
  const texto = valor.toString().padStart(3, '0');
  return `${texto.slice(0, -2)}.${texto.slice(-2)}`;
}
