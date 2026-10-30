import { esErrorApi } from '@/shared/api/errores';

/**
 * Textos del servidor de los que depende la clasificación (la API no manda códigos de error).
 * V17 los comprueba contra la API real para que un cambio de texto no pase inadvertido.
 */
export const TEXTO_DUPLICADA = 'ya tienes una solicitud activa';
export const TEXTO_NO_DISPONIBLE = 'ya no está disponible';
export const TEXTO_PROPIA_FUNDACION = 'propia fundación';

export type ResultadoEnvio =
  { tipo: 'duplicada' } | { tipo: 'no-disponible' } | { tipo: 'otro'; error: unknown };

/** Distingue los rechazos de «Quiero adoptar» que la pantalla trata aparte (R6, R7). */
export function clasificarErrorEnvio(error: unknown): ResultadoEnvio {
  if (!esErrorApi(error)) return { tipo: 'otro', error };
  const texto = error.mensaje.toLowerCase();
  if (error.estado === 409 && texto.includes(TEXTO_DUPLICADA)) return { tipo: 'duplicada' };
  if (error.estado === 409 && texto.includes(TEXTO_NO_DISPONIBLE)) return { tipo: 'no-disponible' };
  if (error.estado === 404) return { tipo: 'no-disponible' };
  if (error.estado === 403 && texto.includes(TEXTO_PROPIA_FUNDACION)) {
    return { tipo: 'no-disponible' };
  }
  return { tipo: 'otro', error };
}

/** Campo del formulario al que pertenece un 400 sin campo, según el texto del servidor. */
export function campoDelMensajeSolicitud(mensaje: string): string | null {
  const texto = mensaje.toLowerCase();
  if (texto.includes('formulario') || texto.includes('archivo')) return 'formulario';
  return null;
}
