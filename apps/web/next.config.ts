import type { NextConfig } from 'next';
import { reescriturasApi } from './shared/config/reescritura-api';

// Valida las variables al cargar la configuración: un valor incoherente detiene la compilación.
const reescrituras = reescriturasApi({
  API_PROXY_DESTINO: process.env.API_PROXY_DESTINO,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});

/** Origen público de la API (de él cuelgan las imágenes `/uploads/…`). */
function origenApi(): URL | null {
  try {
    // Con proxy la URL pública es relativa: las imágenes cuelgan del destino.
    return new URL(
      process.env.API_PROXY_DESTINO ||
        (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'),
    );
  } catch {
    return null;
  }
}

const api = origenApi();

const nextConfig: NextConfig = {
  rewrites: async () => reescrituras,
  images: {
    // Las imágenes se sirven con `unoptimized` (la API ya entrega miniatura y versión grande);
    // el patrón deja listo el optimizador si algún día se activa.
    remotePatterns: api
      ? [
          {
            protocol: api.protocol.replace(':', '') as 'http' | 'https',
            hostname: api.hostname,
            port: api.port,
            pathname: '/uploads/**',
          },
        ]
      : [],
  },
};

export default nextConfig;
