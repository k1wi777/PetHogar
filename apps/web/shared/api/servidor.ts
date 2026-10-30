import { ClienteHttp, type FetchImpl } from './cliente';

const URL_POR_DEFECTO = 'http://localhost:3001/api';

/** Segundos que Next conserva una respuesta pública; el límite de la API es por IP y todas las visitas llegan con la del servidor. */
export const REVALIDAR_SEGUNDOS = 60;
const TIEMPO_ESPERA_MS = 8_000;

/** URL interna de la API para Server Components: `API_URL` (solo servidor) o, si no existe, la pública. */
export function urlApiServidor(): string {
  return process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || URL_POR_DEFECTO;
}

/** URL de la API que usa el navegador (enlaces de descarga). */
export function urlApiPublica(): string {
  return (process.env.NEXT_PUBLIC_API_URL || URL_POR_DEFECTO).replace(/\/+$/, '');
}

/**
 * Cliente para Server Components: público (sin token ni cookies) y con caché de `fetch` de Next.
 * Reutiliza `ClienteHttp` para el mapeo de errores a `ErrorApi`.
 */
export function crearClienteServidor(
  opciones: { baseUrl?: string; fetchImpl?: FetchImpl; revalidar?: number } = {},
): ClienteHttp {
  const base = opciones.fetchImpl ?? ((url, init) => globalThis.fetch(url, init));
  const revalidar = opciones.revalidar ?? REVALIDAR_SEGUNDOS;
  const fetchImpl: FetchImpl = (url, init) =>
    base(url, { ...init, next: { revalidate: revalidar } } as RequestInit);
  return new ClienteHttp({
    baseUrl: opciones.baseUrl ?? urlApiServidor(),
    fetchImpl,
    cerrojos: null,
    tiempoEsperaMs: TIEMPO_ESPERA_MS,
  });
}

/** Cliente de servidor por defecto; se crea en cada uso para leer las variables de entorno en tiempo de ejecución. */
export function clienteServidor(): ClienteHttp {
  return crearClienteServidor();
}
