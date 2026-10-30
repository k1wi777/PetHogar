import { ErrorApi } from '@/shared/api/errores';

/** Solo rutas internas de la API, sin `..`, esquemas ni dobles barras: el token nunca sale de ahí. */
const RUTA_API = /^\/api\/[\w~-]+(?:\/[\w.~-]+)*$/;

/**
 * Las URL de archivos que entrega la API empiezan por `/api/…`, pero el cliente HTTP ya trae
 * `/api` en su URL base: se recorta el prefijo y se rechaza cualquier otra cosa.
 */
export function rutaDeEnlace(url: string): string {
  if (!RUTA_API.test(url) || url.includes('..')) {
    throw new ErrorApi({
      tipo: 'respuesta-invalida',
      mensaje: 'No pudimos abrir el archivo: el enlace recibido no es válido.',
    });
  }
  return url.slice('/api'.length);
}
