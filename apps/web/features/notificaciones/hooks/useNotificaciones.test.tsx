import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorApi } from '@/shared/api/errores';
import { aviso } from '@/shared/ui/Toaster';
import { claves } from './claves';
import { useLeerTodas, useMarcarLeida } from './useNotificaciones';

const api = vi.hoisted(() => ({ marcarLeida: vi.fn(), leerTodas: vi.fn(), listar: vi.fn() }));
vi.mock('@/shared/ui/Toaster', () => ({
  aviso: { error: vi.fn(), exito: vi.fn(), info: vi.fn() },
}));
vi.mock('../api/notificaciones', () => ({
  NOTIFICACIONES_RECIENTES: 5,
  marcarLeida: api.marcarLeida,
  leerTodas: api.leerTodas,
  listarNotificaciones: api.listar,
}));
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => ({ estado: 'autenticado' }) }));

function montar(inicial = 5) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(claves.noLeidas, { noLeidas: inicial });
  const invalidar = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const contador = () => queryClient.getQueryData<{ noLeidas: number }>(claves.noLeidas)?.noLeidas;
  return { queryClient, invalidar, contador, wrapper };
}

beforeEach(() => vi.clearAllMocks());

describe('useMarcarLeida', () => {
  it('baja el contador de inmediato (antes de que responda el servidor) e invalida todo', async () => {
    let terminar: (v: unknown) => void = () => undefined;
    api.marcarLeida.mockImplementation(() => new Promise((r) => (terminar = r)));
    const { contador, invalidar, wrapper } = montar(5);
    const { result } = renderHook(() => useMarcarLeida(), { wrapper });
    act(() => result.current.mutate({ id: 3, leida: false }));
    await waitFor(() => expect(contador()).toBe(4));
    terminar({});
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: claves.todas }));
  });

  it('una ya leída no toca el contador', async () => {
    api.marcarLeida.mockResolvedValue({});
    const { contador, wrapper } = montar(5);
    const { result } = renderHook(() => useMarcarLeida(), { wrapper });
    await act(() => result.current.mutateAsync({ id: 3, leida: true }));
    expect(contador()).toBe(5);
  });

  it('nunca baja de cero', async () => {
    api.marcarLeida.mockResolvedValue({});
    const { contador, wrapper } = montar(0);
    const { result } = renderHook(() => useMarcarLeida(), { wrapper });
    await act(() => result.current.mutateAsync({ id: 3, leida: false }));
    expect(contador()).toBe(0);
  });

  it('si falla, restaura el contador', async () => {
    api.marcarLeida.mockRejectedValue(new ErrorApi({ tipo: 'http', estado: 500, mensaje: 'x' }));
    const { contador, wrapper } = montar(5);
    const { result } = renderHook(() => useMarcarLeida(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 3, leida: false }).catch(() => undefined);
    });
    expect(contador()).toBe(5);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(aviso.error).toHaveBeenCalledOnce();
  });

  it('un 404 es un éxito silencioso: sin error, invalida y no restaura', async () => {
    api.marcarLeida.mockRejectedValue(new ErrorApi({ tipo: 'http', estado: 404, mensaje: 'x' }));
    const { contador, invalidar, wrapper } = montar(5);
    const { result } = renderHook(() => useMarcarLeida(), { wrapper });
    await act(() => result.current.mutateAsync({ id: 3, leida: false }));
    expect(result.current.isError).toBe(false);
    expect(contador()).toBe(4);
    expect(invalidar).toHaveBeenCalledWith({ queryKey: claves.todas });
  });
});

describe('useLeerTodas', () => {
  it('pone el contador en 0 de inmediato e invalida', async () => {
    api.leerTodas.mockResolvedValue({ actualizadas: 5 });
    const { contador, invalidar, wrapper } = montar(5);
    const { result } = renderHook(() => useLeerTodas(), { wrapper });
    await act(() => result.current.mutateAsync());
    expect(contador()).toBe(0);
    expect(invalidar).toHaveBeenCalledWith({ queryKey: claves.todas });
  });

  it('si falla (429), restaura el contador', async () => {
    api.leerTodas.mockRejectedValue(new ErrorApi({ tipo: 'http', estado: 429, mensaje: 'x' }));
    const { contador, wrapper } = montar(5);
    const { result } = renderHook(() => useLeerTodas(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });
    expect(contador()).toBe(5);
  });
});
