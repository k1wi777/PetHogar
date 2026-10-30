import type { Rol } from '@/shared/api/tipos';

/**
 * Indicio de sesión: cookie propia de la web con SOLO el rol. Permite al servidor de Next
 * redirigir antes de renderizar (la cookie `refresh_token` del backend no llega a esas rutas
 * por su `Path=/api/auth`). Es una pista de UX, no una credencial: la autoridad es la API.
 */
export const NOMBRE_INDICIO = 'ph_rol';
export const DURACION_INDICIO_SEGUNDOS = 7 * 24 * 60 * 60;
export const ROLES: readonly Rol[] = ['adoptante', 'fundacion', 'administrador'];

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === 'string' && (ROLES as readonly string[]).includes(valor);
}

export function leerIndicio(
  cookies: string = typeof document === 'undefined' ? '' : document.cookie,
): Rol | null {
  for (const parte of cookies.split(';')) {
    const [nombre, ...resto] = parte.trim().split('=');
    if (nombre === NOMBRE_INDICIO) {
      const valor = resto.join('=');
      return esRol(valor) ? valor : null;
    }
  }
  return null;
}

export function escribirIndicio(rol: Rol): void {
  const segura =
    typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${NOMBRE_INDICIO}=${rol}; Path=/; Max-Age=${DURACION_INDICIO_SEGUNDOS}; SameSite=Lax${segura}`;
}

export function borrarIndicio(): void {
  document.cookie = `${NOMBRE_INDICIO}=; Path=/; Max-Age=0; SameSite=Lax`;
}
