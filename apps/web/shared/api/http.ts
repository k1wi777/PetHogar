import { crearClienteHttp } from './cliente';

function resolverBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (url) return url;
  // En el servidor (compilación) se admite el valor por defecto; en el navegador de producción la variable es obligatoria.
  if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
    throw new Error('Falta NEXT_PUBLIC_API_URL: indica la URL base de la API.');
  }
  return 'http://localhost:3001/api';
}

/** Instancia única del cliente HTTP de la aplicación. */
export const http = crearClienteHttp({ baseUrl: resolverBaseUrl() });
