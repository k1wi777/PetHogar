import type { NextConfig } from 'next';

/** Origen público de la API (de él cuelgan las imágenes `/uploads/…`). */
function origenApi(): URL | null {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api');
  } catch {
    return null;
  }
}

const api = origenApi();

const nextConfig: NextConfig = {
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
