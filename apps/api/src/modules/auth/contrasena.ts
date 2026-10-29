import * as bcrypt from 'bcryptjs';

/** Coste bcrypt de las contraseñas de usuario (el seed del administrador usa 12). */
export const COSTE_BCRYPT = 10;

/** Hash válido de una contraseña que nadie conoce: iguala el tiempo cuando el correo no existe. */
const HASH_FICTICIO = '$2b$10$rJTIPCD4LjbQtxCNW5DUteSRibj0obqW0VD5jhdAHDMihtczK59Ju';

export function hashearContrasena(contrasena: string): Promise<string> {
  return bcrypt.hash(contrasena, COSTE_BCRYPT);
}

export function compararContrasena(contrasena: string, hash: string): Promise<boolean> {
  return bcrypt.compare(contrasena, hash);
}

/** Realiza una comparación sin resultado útil, solo para consumir el mismo tiempo. */
export async function comparacionFicticia(contrasena: string): Promise<void> {
  await bcrypt.compare(contrasena, HASH_FICTICIO);
}
