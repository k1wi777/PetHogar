import { randomInt, timingSafeEqual } from 'node:crypto';
import { hashHmac } from './tokens.util';

const LONGITUD_CODIGO = 6;
const VALORES_CODIGO = 10 ** LONGITUD_CODIGO;

/** Código de 6 dígitos con CSPRNG (uniforme) y ceros a la izquierda. */
export function generarCodigo(): string {
  return randomInt(0, VALORES_CODIGO).toString().padStart(LONGITUD_CODIGO, '0');
}

/**
 * HMAC-SHA256 en hex del código. Con solo 10^6 valores un SHA-256 simple se invertiría en
 * milisegundos desde un volcado de BD; el secreto lo impide. El prefijo y el usuario separan
 * el dominio (no sirve como hash de refresh ni entre cuentas).
 */
export function hashearCodigo(secreto: string, usuarioId: number, codigo: string): string {
  return hashHmac(secreto, `reset:${usuarioId}:${codigo}`);
}

/** Comparación en tiempo constante entre dos hashes hex. */
export function hashesIguales(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}
