import { MENSAJES, esErrorApi } from '@/shared/api/errores';

export const MENSAJE_LIMITE =
  'Hiciste demasiados intentos en poco tiempo. Espera un minuto e inténtalo de nuevo.';

export type SalidaError =
  | { tipo: 'campos'; campos: Array<{ campo: string; mensaje: string }>; aviso?: string }
  | { tipo: 'aviso'; mensaje: string }
  | { tipo: 'transitorio'; mensaje: string };

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

/**
 * Traduce un error de la API a una de tres salidas: por campo (validación 400 y duplicados 409),
 * aviso del formulario (cualquier otro error con mensaje) o transitorio (429 y red).
 * Los campos desconocidos para el formulario suben al aviso: nunca se pierde un mensaje.
 */
export function traducirError(error: unknown, camposConocidos: readonly string[]): SalidaError {
  if (!esErrorApi(error)) return { tipo: 'aviso', mensaje: MENSAJES.generico };
  if (error.tipo === 'red') return { tipo: 'transitorio', mensaje: MENSAJES.red };
  if (error.estado === 429) return { tipo: 'transitorio', mensaje: MENSAJE_LIMITE };

  const conocido = (campo: string) => camposConocidos.includes(campo);
  if (error.estado === 400 && error.errores?.length) {
    const campos: Array<{ campo: string; mensaje: string }> = [];
    const sueltos: string[] = [];
    for (const { campo, mensajes } of error.errores) {
      const mensaje = mensajes[0];
      if (!mensaje) continue;
      if (conocido(campo)) campos.push({ campo, mensaje });
      else sueltos.push(mensaje);
    }
    if (campos.length > 0 || sueltos.length > 0) {
      return { tipo: 'campos', campos, aviso: sueltos.length ? sueltos.join(' ') : undefined };
    }
  }
  if (error.estado >= 400 && error.estado < 500) {
    const campo = campoDelMensaje(error.mensaje, error.estado);
    if (campo && conocido(campo)) {
      return { tipo: 'campos', campos: [{ campo, mensaje: error.mensaje }] };
    }
  }
  return { tipo: 'aviso', mensaje: error.mensaje };
}

interface Destinos {
  /** `setError` de React Hook Form (el primero recibe el foco). */
  marcarCampo(campo: string, mensaje: string, enfocar: boolean): void;
  mostrarAviso(mensaje: string | null): void;
}

/** Aplica la traducción a un formulario; devuelve la salida por si el llamador necesita decidir algo más. */
export function aplicarError(
  error: unknown,
  camposConocidos: readonly string[],
  destinos: Destinos,
): SalidaError {
  const salida = traducirError(error, camposConocidos);
  if (salida.tipo === 'campos') {
    salida.campos.forEach(({ campo, mensaje }, i) => destinos.marcarCampo(campo, mensaje, i === 0));
    destinos.mostrarAviso(salida.aviso ?? null);
  } else {
    destinos.mostrarAviso(salida.mensaje);
  }
  return salida;
}
