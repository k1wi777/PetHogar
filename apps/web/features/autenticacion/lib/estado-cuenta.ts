import { esErrorApi } from '@/shared/api/errores';

export type EstadoLogin =
  'credenciales' | 'bloqueada' | 'desactivada' | 'sin-verificar' | 'transitorio' | 'otro';

/**
 * El login no devuelve códigos de error: distingue por estado HTTP y por el inicio del mensaje en
 * español (verificado en V17 contra la API real). La UI siempre muestra el mensaje del servidor;
 * esta clasificación solo decide la acción adicional (p. ej. ofrecer reenviar el enlace).
 */
export function clasificarErrorLogin(error: unknown): EstadoLogin {
  if (!esErrorApi(error)) return 'otro';
  if (error.tipo === 'red' || error.estado === 429) return 'transitorio';
  if (error.estado === 401) return 'credenciales';
  if (error.estado === 403) {
    if (error.mensaje.startsWith('Cuenta bloqueada')) return 'bloqueada';
    if (error.mensaje.startsWith('Tu cuenta está desactivada')) return 'desactivada';
    if (error.mensaje.startsWith('Debes verificar tu correo')) return 'sin-verificar';
  }
  return 'otro';
}
