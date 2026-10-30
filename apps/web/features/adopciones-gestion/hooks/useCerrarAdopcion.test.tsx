import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorApi } from '@/shared/api/errores';
import {
  CLAVE_ADOPCIONES_GESTION,
  CLAVE_MASCOTAS_GESTION,
  CLAVE_SOLICITUDES_GESTION,
} from '@/shared/lib/claves-consulta';
import { adopcion } from '../prueba-datos';
import { useCerrarAdopcion, useSubirActa } from './useAdopcionesGestion';

const api = vi.hoisted(() => ({ cerrar: vi.fn(), subir: vi.fn() }));
vi.mock('../api/adopciones', () => ({
  cerrarAdopcion: api.cerrar,
  subirActa: api.subir,
  listarAdopciones: vi.fn(),
  obtenerSeguimiento: vi.fn(),
  programarSeguimiento: vi.fn(),
  registrarResultado: vi.fn(),
}));
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => ({ estado: 'autenticado' }) }));

function montar<T>(hook: () => T) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidar = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { invalidar, ...renderHook(hook, { wrapper }) };
}
const claves = (invalidar: ReturnType<typeof vi.fn>) =>
  invalidar.mock.calls.map(([f]) => (f as { queryKey: string[] }).queryKey[0]);

beforeEach(() => vi.clearAllMocks());

describe('useCerrarAdopcion', () => {
  it('al cerrar invalida adopciones, mascotas y solicitudes de la fundación', async () => {
    api.cerrar.mockResolvedValue(adopcion({ estado: 'finalizada' }));
    const { result, invalidar } = montar(() => useCerrarAdopcion(1));
    await act(() => result.current.mutateAsync({ estado: 'finalizada', motivo: 'Todo bien' }));
    expect(api.cerrar).toHaveBeenCalledWith(1, { estado: 'finalizada', motivo: 'Todo bien' });
    expect(claves(invalidar)).toEqual(
      expect.arrayContaining([
        CLAVE_ADOPCIONES_GESTION,
        CLAVE_MASCOTAS_GESTION,
        CLAVE_SOLICITUDES_GESTION,
      ]),
    );
  });

  it('con un 409 vuelve a leer las adopciones (otro miembro pudo cerrarla)', async () => {
    api.cerrar.mockRejectedValue(new ErrorApi({ tipo: 'http', estado: 409, mensaje: 'cerrada' }));
    const { result, invalidar } = montar(() => useCerrarAdopcion(1));
    await act(async () => {
      await result.current
        .mutateAsync({ estado: 'finalizada', motivo: 'x' })
        .catch(() => undefined);
    });
    expect(claves(invalidar)).toEqual([CLAVE_ADOPCIONES_GESTION]);
  });
});

describe('useSubirActa', () => {
  it('sube el archivo e invalida las adopciones', async () => {
    api.subir.mockResolvedValue(adopcion({ acta: { url: '/api/fundacion/adopciones/1/acta' } }));
    const { result, invalidar } = montar(() => useSubirActa(1));
    const acta = new File([new Uint8Array(2)], 'a.pdf', { type: 'application/pdf' });
    await act(() => result.current.mutateAsync(acta));
    expect(api.subir).toHaveBeenCalledWith(1, acta);
    expect(claves(invalidar)).toEqual([CLAVE_ADOPCIONES_GESTION]);
  });
});
