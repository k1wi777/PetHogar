import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorApi, montarPanel, respuestaJson } from '@/shared/testing/prueba-utils';
import type { Serie } from '../lib/series';
import { estadisticas } from '../prueba-datos';
import { PantallaReportes } from './PantallaReportes';

let consulta = '';
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(consulta),
  useRouter: () => ({ push }),
  usePathname: () => '/administrador/reportes',
}));
vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
const sesion = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }));
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => sesion.valor }));
vi.mock('./VistaBarras', () => ({
  default: ({ serie }: { serie: Serie }) => <div data-testid="vista-barras">{serie.id}</div>,
}));
vi.mock('./VistaDona', () => ({
  default: ({ serie }: { serie: Serie }) => <div data-testid="vista-dona">{serie.id}</div>,
}));

beforeEach(() => {
  consulta = '';
  push.mockClear();
  sesion.valor = {
    estado: 'autenticado',
    usuario: { id: 1, rol: 'administrador', fundacion: null },
    refrescarPerfil: vi.fn(),
    cerrarSesion: vi.fn(),
  };
});

const FUNDACIONES = {
  total: 2,
  page: 1,
  limit: 100,
  data: [
    { id: 4, nombre: 'Patitas', nit: '1' },
    { id: 9, nombre: 'Huellas', nit: '2' },
  ],
};

function api(extra?: (ruta: string) => Response | undefined) {
  return (ruta: string) =>
    extra?.(ruta) ??
    (ruta.startsWith('/admin/fundaciones')
      ? respuestaJson(FUNDACIONES)
      : respuestaJson(estadisticas()));
}

describe('PantallaReportes (administrador)', () => {
  it('consulta toda la plataforma, indica que son gráficas y tablas y no ofrece PDF en ningún tipo', async () => {
    const { llamadas } = montarPanel(<PantallaReportes ambito="administrador" />, api());
    expect(await screen.findByRole('region', { name: 'Totales' })).toBeVisible();
    expect(screen.getByRole('note')).toHaveTextContent('se consultan en gráficas y tablas');
    expect(screen.getByRole('heading', { name: /· Toda la plataforma/ })).toBeVisible();
    const peticion = llamadas('/admin/estadisticas')[0]![0];
    expect(peticion).not.toContain('fundacionId');
    expect(llamadas('/fundacion/estadisticas')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Descargar PDF/ })).toBeNull();
  });

  it.each(['solicitudes', 'seguimientos', 'donaciones'])(
    'la pestaña %s no ofrece «Descargar PDF» al administrador',
    async (reporte) => {
      consulta = `reporte=${reporte}`;
      montarPanel(<PantallaReportes ambito="administrador" />, api());
      await screen.findByRole('region', { name: 'Totales' });
      expect(screen.getAllByRole('table').length).toBeGreaterThan(0);
      expect(screen.queryByRole('button', { name: /Descargar PDF/ })).toBeNull();
    },
  );

  it('el selector lista «Todas» y las fundaciones aprobadas y elegir una navega con su id', async () => {
    montarPanel(<PantallaReportes ambito="administrador" />, api());
    await screen.findByRole('region', { name: 'Totales' });
    await userEvent.click(screen.getByRole('combobox', { name: 'Fundación' }));
    const opciones = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(opciones).toEqual(['Todas las fundaciones', 'Patitas', 'Huellas']);
    await userEvent.click(screen.getByRole('option', { name: 'Huellas' }));
    expect(push).toHaveBeenCalledWith('/administrador/reportes?fundacion=9');
  });

  it('con fundación en la URL envía fundacionId junto al rango y la nombra en el resultado', async () => {
    consulta = 'fundacion=4&desde=2026-10-01&hasta=2026-10-31';
    const { llamadas } = montarPanel(<PantallaReportes ambito="administrador" />, api());
    expect(await screen.findByRole('heading', { name: /· Patitas/ })).toBeVisible();
    const url = llamadas('/admin/estadisticas')[0]![0];
    expect(url).toContain('fundacionId=4');
    expect(url).toContain('desde=2026-10-01');
    expect(url).toContain('hasta=2026-10-31');
  });

  it('elegir «Todas» quita la fundación y conserva el rango y el reporte', async () => {
    consulta = 'reporte=donaciones&fundacion=4&desde=2026-10-01';
    montarPanel(<PantallaReportes ambito="administrador" />, api());
    await screen.findByRole('region', { name: 'Totales' });
    await userEvent.click(screen.getByRole('combobox', { name: 'Fundación' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Todas las fundaciones' }));
    expect(push).toHaveBeenCalledWith(
      '/administrador/reportes?reporte=donaciones&desde=2026-10-01',
    );
  });

  it('una fundación de la URL fuera de la lista se conserva como opción', async () => {
    consulta = 'fundacion=777';
    montarPanel(<PantallaReportes ambito="administrador" />, api());
    expect(await screen.findByRole('combobox', { name: 'Fundación' })).toHaveTextContent(
      'Fundación #777',
    );
  });

  it('una fundación inexistente (404) se avisa con un mensaje claro y permite volver a toda la plataforma', async () => {
    consulta = 'fundacion=999999';
    montarPanel(
      <PantallaReportes ambito="administrador" />,
      api((ruta) =>
        ruta.startsWith('/admin/estadisticas')
          ? errorApi(404, 'La fundación no existe')
          : undefined,
      ),
    );
    expect(await screen.findByText('La fundación indicada no existe')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Ver toda la plataforma' }));
    expect(push).toHaveBeenCalledWith('/administrador/reportes');
  });

  it('un 400 del servidor se muestra con su mensaje y Reintentar', async () => {
    montarPanel(
      <PantallaReportes ambito="administrador" />,
      api((ruta) =>
        ruta.startsWith('/admin/estadisticas') ? errorApi(400, 'Rango inválido') : undefined,
      ),
    );
    const alerta = await screen.findByRole('alert');
    expect(within(alerta).getByText('Rango inválido')).toBeVisible();
    expect(within(alerta).getByRole('button', { name: 'Reintentar' })).toBeVisible();
  });

  it('sin fundaciones cargadas el selector sigue operando y lo avisa', async () => {
    montarPanel(
      <PantallaReportes ambito="administrador" />,
      api((ruta) => (ruta.startsWith('/admin/fundaciones') ? errorApi(500, 'Falló') : undefined)),
    );
    expect(await screen.findByText(/No pudimos cargar las fundaciones/)).toBeVisible();
    expect(await screen.findByRole('region', { name: 'Totales' })).toBeVisible();
  });
});
