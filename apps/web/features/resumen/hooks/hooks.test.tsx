import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crearClienteHttp } from '@/shared/api/cliente';
import { BASE, respuestaJson, usuarioFundacion } from '@/shared/testing/prueba-utils';
import { fijarClientePrueba } from '@/shared/testing/http-prueba';
import { claves } from './claves';
import { useResumenAdministrador } from './useResumenAdministrador';
import { useResumenAdoptante } from './useResumenAdoptante';
import { useResumenFundacion } from './useResumenFundacion';

vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
const sesion = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }));
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => sesion.valor }));

const pagina = { total: 0, page: 1, limit: 1, data: [] };
const fetchImpl = vi.fn(async (url: string) => {
  const ruta = url.replace(BASE, '');
  if (ruta.startsWith('/notificaciones')) return respuestaJson({ noLeidas: 2 });
  if (ruta.startsWith('/fundacion/donaciones'))
    return respuestaJson({
      ...pagina,
      totales: { economica: { cantidad: 0, monto: '0.00' }, especie: { cantidad: 0 } },
    });
  return respuestaJson(pagina);
});

function envoltura() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Envoltura = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, Envoltura };
}
const llamadasA = (prefijo: string) =>
  fetchImpl.mock.calls.filter(([u]) => u.replace(BASE, '').startsWith(prefijo));

beforeEach(() => {
  fetchImpl.mockClear();
  fijarClientePrueba(crearClienteHttp({ baseUrl: BASE, fetchImpl, cerrojos: null }));
});

describe('hooks de resumen', () => {
  it('claves de fundación y administrador cuelgan de los prefijos compartidos', () => {
    expect(claves.fundacion.mascotas[0]).toBe('mascotas-gestion');
    expect(claves.fundacion.solicitudes[0]).toBe('solicitudes-gestion');
    expect(claves.fundacion.donaciones('a', 'b')[0]).toBe('donaciones-gestion');
    expect(claves.administrador.fundaciones[0]).toBe('admin-fundaciones');
    expect(claves.administrador.estadisticas[0]).toBe('reportes');
    expect(claves.noLeidas[0]).toBe('notificaciones');
    expect(claves.noLeidas).not.toEqual(['notificaciones', 'no-leidas']);
  });

  it('el adoptante no consulta sin sesión', () => {
    sesion.valor = { estado: 'anonimo', usuario: null };
    const { Envoltura } = envoltura();
    renderHook(() => useResumenAdoptante(), { wrapper: Envoltura });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('el adoptante lanza sus 6 peticiones con sesión', async () => {
    sesion.valor = { estado: 'autenticado', usuario: null };
    const { Envoltura } = envoltura();
    const { result } = renderHook(() => useResumenAdoptante(), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.notificaciones.data).toBe(2));
    await waitFor(() => expect(result.current.seguimientos.isSuccess).toBe(true));
    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });

  it('la fundación pendiente no lanza peticiones', () => {
    sesion.valor = { estado: 'autenticado', usuario: usuarioFundacion('pendiente') };
    const { Envoltura } = envoltura();
    renderHook(() => useResumenFundacion(), { wrapper: Envoltura });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('la fundación aprobada lanza 9 peticiones con el mes de Bogotá', async () => {
    sesion.valor = { estado: 'autenticado', usuario: usuarioFundacion('aprobada') };
    const { Envoltura } = envoltura();
    const { result } = renderHook(() => useResumenFundacion(), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.donaciones.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.seguimientos.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.mascotas.isSuccess).toBe(true));
    expect(llamadasA('/fundacion/mascotas')).toHaveLength(4);
    expect(fetchImpl).toHaveBeenCalledTimes(9);
    const url = llamadasA('/fundacion/donaciones')[0]![0];
    expect(url).toMatch(/desde=\d{4}-\d{2}-01/);
    expect(url).toMatch(/hasta=\d{4}-\d{2}-\d{2}/);
  });

  it('el administrador lanza 3 peticiones con sesión', async () => {
    sesion.valor = { estado: 'autenticado', usuario: null };
    const { Envoltura } = envoltura();
    const { result } = renderHook(() => useResumenAdministrador(), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.estadisticas.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.notificaciones.isSuccess).toBe(true));
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
