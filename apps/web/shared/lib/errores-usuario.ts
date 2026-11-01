import { ErrorApi, MENSAJES, esErrorApi } from '@/shared/api/errores';

/** Por qué falló una operación; sirve para decidir la acción posible (reintentar, ingresar…). */
export type CausaError =
  | 'red'
  | 'limite'
  | 'servidor'
  | 'sesion'
  | 'permiso'
  | 'no-encontrado'
  | 'solicitud'
  | 'desconocida';

export interface ErrorTraducido {
  mensaje: string;
  causa: CausaError;
}

export const MENSAJE_LIMITE =
  'Hiciste demasiados intentos en poco tiempo. Espera un minuto e inténtalo de nuevo.';

const MENSAJE_PERMISO =
  'Tu cuenta no tiene permiso para hacer esto. Vuelve al inicio e inténtalo con la cuenta correcta.';
const MENSAJE_NO_ENCONTRADO =
  'No encontramos lo que buscas. Puede que ya no exista; actualiza la página.';

/** Textos de frameworks, códigos HTTP, JSON o excepciones: nunca deben llegar al usuario. */
const TECNICO =
  /(failed to fetch|networkerror|load failed|exception|unauthorized|forbidden|not found|bad request|internal server error|too many requests|bad gateway|service unavailable|gateway time-?out|cannot (get|post|put|patch|delete)|^\s*[{[<]|\b[1-5]\d{2}\b\s*(error|:)|\bundefined\b|\bnull\b|\[object )/i;

function esLegible(mensaje: string): boolean {
  const texto = mensaje.trim();
  return (
    texto.length > 0 &&
    texto !== MENSAJES.generico &&
    texto !== MENSAJES.servidor &&
    !TECNICO.test(texto)
  );
}

/**
 * Único traductor de errores de red/HTTP a un mensaje en español con su causa (R5). Los 4xx de
 * negocio y los 429 conservan el mensaje del servidor (ya viene en español, p. ej. «Demasiadas
 * descargas…») salvo que sea técnico o falte; red, 5xx y sesión siempre usan textos propios. No toca la traducción por campo
 * (`errores-formulario`).
 */
export function describirError(error: unknown): ErrorTraducido {
  if (!esErrorApi(error)) return { mensaje: MENSAJES.generico, causa: 'desconocida' };
  return describirErrorApi(error);
}

function describirErrorApi(error: ErrorApi): ErrorTraducido {
  if (error.tipo === 'red') return { mensaje: MENSAJES.red, causa: 'red' };
  if (error.tipo === 'sesion-vencida') return { mensaje: MENSAJES.sesionVencida, causa: 'sesion' };
  if (error.tipo === 'respuesta-invalida') {
    // Incluye los enlaces inválidos que rechaza el propio cliente, con su texto en español.
    return {
      mensaje: esLegible(error.mensaje) ? error.mensaje : MENSAJES.respuestaInvalida,
      causa: 'servidor',
    };
  }
  const { estado, mensaje } = error;
  const legible = esLegible(mensaje) ? mensaje : null;
  if (estado === 429) return { mensaje: legible ?? MENSAJE_LIMITE, causa: 'limite' };
  if (estado >= 500) return { mensaje: MENSAJES.servidor, causa: 'servidor' };
  if (estado === 401) {
    return { mensaje: legible ?? MENSAJES.sesionVencida, causa: 'sesion' };
  }
  if (estado === 403) return { mensaje: legible ?? MENSAJE_PERMISO, causa: 'permiso' };
  if (estado === 404) return { mensaje: legible ?? MENSAJE_NO_ENCONTRADO, causa: 'no-encontrado' };
  return { mensaje: legible ?? MENSAJES.generico, causa: 'solicitud' };
}

/** Mensaje presentable de cualquier error capturado. */
export function mensajeDe(error: unknown): string {
  return describirError(error).mensaje;
}
