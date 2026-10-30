import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import type { ReactNode } from 'react';
import { crearClienteHttp, type FetchImpl } from '@/shared/api/cliente';
import type { Rol, Usuario } from '@/shared/api/tipos';
import { SesionProvider } from '@/shared/auth/SesionProvider';
import { fijarClientePrueba } from './http-prueba';

/** Utilidades compartidas por las pruebas de los formularios (no forman parte de la aplicación). */

export const BASE = 'http://api.test/api';

export function respuestaJson(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorApi(estado: number, message: string, errores?: unknown): Response {
  return respuestaJson({ statusCode: estado, message, errores }, estado);
}

export function usuarioDe(rol: Rol, fundacion?: Usuario['fundacion']): Usuario {
  return {
    id: 1,
    email: 'u@x.co',
    telefono: '3001234567',
    rol,
    adoptante:
      rol === 'adoptante'
        ? {
            primerNombre: 'Ana',
            segundoNombre: null,
            primerApellido: 'Pérez',
            segundoApellido: null,
          }
        : null,
    fundacion: rol === 'fundacion' ? (fundacion ?? null) : null,
  };
}

export type Manejador = (ruta: string, init?: RequestInit) => Response | Promise<Response>;

/** Renderiza con el cliente HTTP real y un `fetch` simulado; las rutas no cubiertas fallan a propósito. */
export function montar(ui: ReactNode, manejador: Manejador) {
  const fetchImpl = vi.fn<FetchImpl>(async (url, init) => {
    const ruta = url.replace(BASE, '');
    if (ruta === '/auth/refresh') return errorApi(401, 'Sin sesión');
    return manejador(ruta, init);
  });
  const cliente = crearClienteHttp({ baseUrl: BASE, fetchImpl, cerrojos: null });
  fijarClientePrueba(cliente);
  const resultado = render(
    <QueryClientProvider client={new QueryClient()}>
      <SesionProvider cliente={cliente}>{ui}</SesionProvider>
    </QueryClientProvider>,
  );
  const llamadas = (ruta: string) =>
    fetchImpl.mock.calls.filter(([url]) => url.replace(BASE, '').startsWith(ruta));
  return { ...resultado, fetchImpl, cliente, llamadas };
}

export function cuerpoJson(llamada: Parameters<FetchImpl>): Record<string, unknown> {
  return JSON.parse(llamada[1]!.body as string) as Record<string, unknown>;
}
