import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claves } from './claves';
import { useNoLeidas } from './useNoLeidas';

const contar = vi.hoisted(() => vi.fn());
vi.mock('../api/contar', () => ({ contarNoLeidas: contar }));
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => ({ estado: 'autenticado' }) }));

function visibilidad(valor: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => valor });
  document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
}

/** Avanza un intervalo y deja que TanStack notifique el resultado (usa un timeout de 0 ms). */
async function ciclo() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.advanceTimersByTimeAsync(10);
  });
}

function montar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidar = vi.spyOn(queryClient, 'invalidateQueries');
  const envoltorio = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, invalidar, ...renderHook(() => useNoLeidas(), { wrapper: envoltorio }) };
}

beforeEach(() => {
  vi.useFakeTimers();
  contar.mockReset();
  visibilidad('visible');
});
afterEach(() => {
  visibilidad('visible');
  focusManager.setFocused(undefined);
  vi.useRealTimers();
});

describe('useNoLeidas', () => {
  it('consulta al montar y luego cada 30 s', async () => {
    contar.mockResolvedValue({ noLeidas: 2 });
    const { result } = montar();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.data).toBe(2);
    expect(contar).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(29_000));
    expect(contar).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(contar).toHaveBeenCalledTimes(2);
  });

  it('no consulta con la pestaña oculta y al volver consulta una sola vez', async () => {
    contar.mockResolvedValue({ noLeidas: 1 });
    montar();
    await act(() => vi.advanceTimersByTimeAsync(0));
    visibilidad('hidden');
    await act(() => vi.advanceTimersByTimeAsync(5 * 30_000));
    expect(contar).toHaveBeenCalledTimes(1);
    visibilidad('visible');
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(contar).toHaveBeenCalledTimes(2);
  });

  it('no solapa peticiones: con una en vuelo no lanza otra', async () => {
    let resolver: (v: { noLeidas: number }) => void = () => undefined;
    contar.mockImplementation(() => new Promise((r) => (resolver = r)));
    montar();
    await act(() => vi.advanceTimersByTimeAsync(5 * 30_000));
    expect(contar).toHaveBeenCalledTimes(1);
    resolver({ noLeidas: 0 });
    await act(() => vi.advanceTimersByTimeAsync(0));
  });

  it('si un ciclo falla conserva el último valor y reintenta en el siguiente', async () => {
    contar.mockResolvedValueOnce({ noLeidas: 4 }).mockRejectedValueOnce(new Error('429'));
    contar.mockResolvedValue({ noLeidas: 6 });
    const { result } = montar();
    await act(() => vi.advanceTimersByTimeAsync(0));
    await ciclo();
    expect(result.current.data).toBe(4);
    expect(contar).toHaveBeenCalledTimes(2);
    await ciclo();
    expect(result.current.data).toBe(6);
  });

  it('invalida lista y recientes solo cuando el contador sube', async () => {
    contar
      .mockResolvedValueOnce({ noLeidas: 1 })
      .mockResolvedValueOnce({ noLeidas: 1 })
      .mockResolvedValueOnce({ noLeidas: 3 })
      .mockResolvedValue({ noLeidas: 2 });
    const { invalidar } = montar();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(invalidar).not.toHaveBeenCalled();
    await ciclo();
    expect(invalidar).not.toHaveBeenCalled();
    await ciclo();
    expect(invalidar).toHaveBeenCalledWith({ queryKey: claves.lista() });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: claves.recientes });
    invalidar.mockClear();
    await ciclo();
    expect(invalidar).not.toHaveBeenCalled();
  });
});
