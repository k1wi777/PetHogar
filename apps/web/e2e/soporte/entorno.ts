/** Variables del e2e (el config ya garantiza que existen). */
function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable ${nombre}`);
  return valor;
}

export const API_URL = requerida('E2E_API_URL').replace(/\/+$/, '');
export const MAILPIT_URL = requerida('E2E_MAILPIT_URL').replace(/\/+$/, '');
export const CLAVE_DEMO = requerida('E2E_DEMO_PASSWORD');
export const CLAVE_ADMIN = requerida('E2E_ADMIN_PASSWORD');
export const CORREO_ADMIN = process.env.E2E_ADMIN_EMAIL ?? 'admin@pethogar.local';
export const CORREO_ADOPTANTE_DEMO =
  process.env.E2E_ADOPTANTE_EMAIL ?? 'adoptante.demo@pethogar.local';
export const CORREO_FUNDACION_DEMO =
  process.env.E2E_FUNDACION_EMAIL ?? 'fundacion.demo@pethogar.local';
