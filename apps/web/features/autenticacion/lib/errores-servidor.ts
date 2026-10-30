import {
  aplicarError as aplicarErrorBase,
  traducirError as traducirErrorBase,
  type SalidaError,
} from '@/shared/lib/errores-formulario';

export { MENSAJE_LIMITE, type SalidaError } from '@/shared/lib/errores-formulario';

/** Campo al que pertenece un 409/400 sin campo, según el texto del servidor. */
function campoDelMensaje(mensaje: string, estado: number): string | null {
  const texto = mensaje.toLowerCase();
  if (estado === 409) {
    if (texto.includes('número de documento')) return 'numeroDocumento';
    if (texto.includes('nit')) return 'nit';
    if (texto.includes('correo')) return 'email';
    return null;
  }
  if (texto.includes('mayor de 18')) return 'fechaNacimiento';
  if (texto.includes('archivo') || texto.includes('documento legal')) return 'documento';
  return null;
}

/** Traducción de errores del registro y la autenticación (la lógica común vive en `shared`). */
export function traducirError(error: unknown, camposConocidos: readonly string[]): SalidaError {
  return traducirErrorBase(error, camposConocidos, campoDelMensaje);
}

export function aplicarError(
  error: unknown,
  camposConocidos: readonly string[],
  destinos: Parameters<typeof aplicarErrorBase>[2],
): SalidaError {
  return aplicarErrorBase(error, camposConocidos, destinos, campoDelMensaje);
}
