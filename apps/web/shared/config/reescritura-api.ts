/**
 * Proxy same-origin de la API (demo con web y API en sitios distintos). Lo importa
 * `next.config.ts`, así que no debe depender de alias ni de código de la aplicación.
 */

export interface VariablesApi {
  API_PROXY_DESTINO?: string;
  NEXT_PUBLIC_API_URL?: string;
}

export interface ReescrituraApi {
  source: string;
  destination: string;
}

const RUTA_PROXY = '/api';

function esUrlHttpAbsoluta(valor: string): boolean {
  if (!/^https?:\/\//i.test(valor)) return false;
  try {
    return Boolean(new URL(valor).hostname);
  } catch {
    return false;
  }
}

/**
 * Valida las variables de la API y devuelve las reescrituras de Next: ninguna si no hay destino.
 * Un error aquí detiene la compilación.
 */
export function reescriturasApi(env: VariablesApi): ReescrituraApi[] {
  const destino = env.API_PROXY_DESTINO;
  const publica = env.NEXT_PUBLIC_API_URL;

  if (!destino) {
    if (publica && !/^[a-z][a-z0-9+.-]*:/i.test(publica)) {
      throw new Error(
        'NEXT_PUBLIC_API_URL: no puede ser una ruta relativa sin proxy. Indica la URL completa ' +
          'de la API (p. ej. http://localhost:3001/api) o define API_PROXY_DESTINO.',
      );
    }
    return [];
  }

  if (!esUrlHttpAbsoluta(destino)) {
    throw new Error(
      'API_PROXY_DESTINO: debe ser una URL HTTP(S) absoluta que incluya /api ' +
        '(p. ej. https://mi-api.example.com/api).',
    );
  }
  if (publica !== RUTA_PROXY) {
    throw new Error(
      `NEXT_PUBLIC_API_URL: con API_PROXY_DESTINO configurado debe valer ${RUTA_PROXY}.`,
    );
  }
  return [{ source: `${RUTA_PROXY}/:path*`, destination: `${destino.replace(/\/+$/, '')}/:path*` }];
}
