import { createHash, createHmac, randomBytes } from 'node:crypto';

/** Token opaco de 256 bits; solo viaja al cliente, en BD se guarda su hash. */
export function generarTokenOpaco(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 en hex (64 caracteres): válido para tokens que ya tienen alta entropía. */
export function hashSha256(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** HMAC-SHA256 en hex: el secreto actúa como pimienta; un volcado de BD no permite validar tokens. */
export function hashHmac(secreto: string, token: string): string {
  return createHmac('sha256', secreto).update(token).digest('hex');
}
