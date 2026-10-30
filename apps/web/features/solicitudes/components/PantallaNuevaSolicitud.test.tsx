import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorApi, montarPanel, respuestaJson } from '@/shared/testing/prueba-utils';
import { MASCOTA } from '../prueba-datos';
import { PantallaNuevaSolicitud, leerMascotaId } from './PantallaNuevaSolicitud';

let consulta = 'mascota=7';
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(consulta) }));
vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
vi.mock('@/shared/auth/SesionProvider', () => ({
  useSesion: () => ({ estado: 'autenticado', usuario: null }),
}));

beforeEach(() => {
  consulta = 'mascota=7';
});

describe('leerMascotaId', () => {
  it.each([
    ['7', 7],
    ['0', null],
    ['-3', null],
    ['abc', null],
    ['7.5', null],
    ['', null],
    [null, null],
  ])('«%s» ⇒ %s', (entrada, esperado) => {
    expect(leerMascotaId(entrada)).toBe(esperado);
  });
});

describe('PantallaNuevaSolicitud', () => {
  it('con un id inválido muestra «no disponible» sin llamar a la API', () => {
    consulta = 'mascota=abc';
    const { llamadas } = montarPanel(<PantallaNuevaSolicitud />, () => respuestaJson({}));
    expect(
      screen.getByRole('heading', { name: 'Esta mascota ya no está disponible' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Ver otras mascotas' })).toHaveAttribute(
      'href',
      '/adoptar',
    );
    expect(llamadas('/mascotas')).toHaveLength(0);
  });

  it('una mascota inexistente (404) muestra «no disponible», sin formulario', async () => {
    montarPanel(<PantallaNuevaSolicitud />, () => errorApi(404, 'La mascota no existe'));
    expect(
      await screen.findByRole('heading', { name: 'Esta mascota ya no está disponible' }),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Revisar mi solicitud' })).toBeNull();
  });

  it('con la mascota disponible muestra el formulario con su nombre y fundación', async () => {
    montarPanel(<PantallaNuevaSolicitud />, () => respuestaJson(MASCOTA));
    expect(await screen.findByRole('heading', { name: /adoptar a Luna/ })).toBeVisible();
    expect(screen.getByText('Patitas')).toBeVisible();
  });

  it('si la API no responde ofrece reintentar', async () => {
    let fallar = true;
    montarPanel(<PantallaNuevaSolicitud />, () => {
      if (fallar) throw new TypeError('x');
      return respuestaJson(MASCOTA);
    });
    const reintentar = await screen.findByRole('button', { name: 'Reintentar' });
    fallar = false;
    reintentar.click();
    expect(await screen.findByRole('heading', { name: /adoptar a Luna/ })).toBeVisible();
  });
});
