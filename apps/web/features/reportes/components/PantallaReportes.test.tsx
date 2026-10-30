import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  errorApi,
  montarPanel,
  respuestaJson,
  usuarioFundacion,
} from '@/shared/testing/prueba-utils';
import type { Serie } from '../lib/series';
import { estadisticas, estadisticasVacias } from '../prueba-datos';
import { PantallaReportes } from './PantallaReportes';

let consulta = '';
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(consulta),
  useRouter: () => ({ push }),
  usePathname: () => '/fundacion/reportes',
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

function ponerSesion(estado: 'pendiente' | 'aprobada' | 'rechazada' = 'aprobada') {
  sesion.valor = {
    estado: 'autenticado',
    usuario: usuarioFundacion(estado),
    refrescarPerfil: vi.fn(),
    cerrarSesion: vi.fn(),
  };
}

const crear = vi.fn(() => 'blob:pdf');
const enlaces: HTMLAnchorElement[] = [];
beforeEach(() => {
  consulta = '';
  push.mockClear();
  enlaces.length = 0;
  ponerSesion();
  URL.createObjectURL = crear;
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    enlaces.push(this);
  });
});
afterEach(() => vi.useRealTimers());

const pdf = () =>
  new Response(new Uint8Array([37, 80, 68, 70]), {
    status: 200,
    headers: { 'Content-Type': 'application/pdf' },
  });

function api(datos = estadisticas()) {
  return (ruta: string) => (ruta.startsWith('/fundacion/reportes/') ? pdf() : respuestaJson(datos));
}

describe('PantallaReportes (fundación)', () => {
  it('muestra totales del servidor, pestañas por tipo y, en adopciones, gráficas con su tabla y sin PDF', async () => {
    const { llamadas } = montarPanel(<PantallaReportes ambito="fundacion" />, api());
    const totales = await screen.findByRole('region', { name: 'Totales' });
    expect(totales).toHaveTextContent('5 adopciones');
    expect(totales).toHaveTextContent('7 solicitudes');
    expect(totales).toHaveTextContent('6 seguimientos');
    expect(totales).toHaveTextContent('Económicas: $ 9.007.199.254.741.093,60');
    const pestanas = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(pestanas).toEqual(['Adopciones', 'Solicitudes', 'Seguimientos', 'Donaciones']);
    expect(screen.getByRole('tab', { name: 'Adopciones' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await screen.findAllByRole('table')).toHaveLength(2);
    expect(screen.getByRole('heading', { level: 3, name: 'Adopciones por mes' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 3, name: 'Adopciones por especie' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Descargar PDF/ })).toBeNull();
    expect(screen.getByRole('heading', { name: /Resultados de todo el periodo/ })).toBeVisible();
    expect(llamadas('/fundacion/estadisticas')).toHaveLength(1);
    // El tipo de reporte no viaja: una sola petición alimenta los cuatro paneles.
    expect(llamadas('/fundacion/estadisticas')[0]![0]).not.toContain('reporte');
  });

  it('cambiar de pestaña va a la URL sin tocar el rango', async () => {
    consulta = 'desde=2026-10-01&hasta=2026-10-31';
    montarPanel(<PantallaReportes ambito="fundacion" />, api());
    await userEvent.click(await screen.findByRole('tab', { name: 'Solicitudes' }));
    expect(push).toHaveBeenCalledWith(
      '/fundacion/reportes?reporte=solicitudes&desde=2026-10-01&hasta=2026-10-31',
    );
  });

  it('la pestaña de la URL decide el panel: solicitudes (dona) con PDF del rango aplicado', async () => {
    consulta = 'reporte=solicitudes&desde=2026-10-01&hasta=2026-10-31';
    const { llamadas } = montarPanel(<PantallaReportes ambito="fundacion" />, api());
    expect(await screen.findByTestId('vista-dona')).toHaveTextContent('solicitudes-por-estado');
    await userEvent.click(screen.getByRole('button', { name: 'Descargar PDF de solicitudes' }));
    await screen.findByText(/reporte-solicitudes-2026-10-01_2026-10-31\.pdf/);
    const [url] = llamadas('/fundacion/reportes/solicitudes.pdf')[0]!;
    expect(url).toContain('desde=2026-10-01');
    expect(url).toContain('hasta=2026-10-31');
    expect(enlaces[0]?.download).toBe('reporte-solicitudes-2026-10-01_2026-10-31.pdf');
    expect(llamadas('/fundacion/estadisticas')[0]![0]).toContain('desde=2026-10-01');
  });

  it.each(['seguimientos', 'donaciones'])('%s ofrece su PDF', async (reporte) => {
    consulta = `reporte=${reporte}`;
    montarPanel(<PantallaReportes ambito="fundacion" />, api());
    expect(
      await screen.findByRole('button', { name: `Descargar PDF de ${reporte}` }),
    ).toBeVisible();
  });

  it('un fallo del PDF (429) se muestra junto al botón y permite reintentar', async () => {
    consulta = 'reporte=donaciones';
    let limite = true;
    montarPanel(<PantallaReportes ambito="fundacion" />, (ruta) =>
      ruta.startsWith('/fundacion/reportes/')
        ? limite
          ? errorApi(429, 'Demasiadas descargas, espera un minuto')
          : pdf()
        : respuestaJson(estadisticas()),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Descargar PDF de donaciones' }),
    );
    expect(await screen.findByText(/Demasiadas descargas/)).toBeVisible();
    limite = false;
    await userEvent.click(screen.getByRole('button', { name: 'Descargar PDF de donaciones' }));
    await screen.findByText(/Listo: guardamos/);
  });

  it('un rango invertido avisa junto al campo, sin navegar ni consultar', async () => {
    const { llamadas } = montarPanel(<PantallaReportes ambito="fundacion" />, api());
    await screen.findByRole('region', { name: 'Totales' });
    await userEvent.type(screen.getByLabelText('Desde'), '2026-10-31');
    await userEvent.type(screen.getByLabelText('Hasta'), '2026-10-01');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar fechas' }));
    expect(
      await screen.findByText('La fecha final no puede ser anterior a la inicial'),
    ).toBeVisible();
    expect(push).not.toHaveBeenCalled();
    expect(llamadas('/fundacion/estadisticas')).toHaveLength(1);
  });

  it('aplicar un rango válido va a la URL conservando el reporte', async () => {
    consulta = 'reporte=donaciones';
    montarPanel(<PantallaReportes ambito="fundacion" />, api());
    await screen.findByRole('region', { name: 'Totales' });
    await userEvent.type(screen.getByLabelText('Desde'), '2026-10-01');
    await userEvent.type(screen.getByLabelText('Hasta'), '2026-10-15');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar fechas' }));
    expect(push).toHaveBeenCalledWith(
      '/fundacion/reportes?reporte=donaciones&desde=2026-10-01&hasta=2026-10-15',
    );
  });

  it('los atajos usan el calendario de Bogotá (el reloj fijo cruza la medianoche UTC)', async () => {
    // 2026-11-01 02:00 UTC es todavía el 31 de octubre en Bogotá.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-01T02:00:00Z') });
    montarPanel(<PantallaReportes ambito="fundacion" />, api());
    await screen.findByRole('region', { name: 'Totales' });
    await userEvent.click(screen.getByRole('button', { name: 'Este mes' }));
    expect(push).toHaveBeenLastCalledWith('/fundacion/reportes?desde=2026-10-01&hasta=2026-10-31');
    await userEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(push).toHaveBeenLastCalledWith('/fundacion/reportes?desde=2026-09-01&hasta=2026-09-30');
    await userEvent.click(screen.getByRole('button', { name: 'Todo' }));
    expect(push).toHaveBeenLastCalledWith('/fundacion/reportes');
  });

  it('sin datos en el rango: estado vacío en texto, sin gráficas', async () => {
    consulta = 'reporte=solicitudes';
    montarPanel(<PantallaReportes ambito="fundacion" />, api(estadisticasVacias()));
    expect(await screen.findByText(/No hay datos para mostrar en este rango/)).toBeVisible();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('con la fundación pendiente muestra el aviso y no consulta nada', () => {
    ponerSesion('pendiente');
    const { fetchImpl } = montarPanel(<PantallaReportes ambito="fundacion" />, api());
    expect(screen.getAllByText(/aprobada|revisará/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole('region', { name: 'Totales' })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('un 403 a mitad de sesión muestra el aviso de fundación no aprobada', async () => {
    montarPanel(<PantallaReportes ambito="fundacion" />, () =>
      errorApi(403, 'Tu fundación aún no está aprobada'),
    );
    expect(
      (await screen.findAllByText(/Tu fundación aún no está aprobada/)).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole('region', { name: 'Totales' })).toBeNull();
    expect((sesion.valor as { cerrarSesion: () => void }).cerrarSesion).not.toHaveBeenCalled();
  });

  it('un error de carga ofrece Reintentar sin cerrar la sesión', async () => {
    let falla = true;
    montarPanel(<PantallaReportes ambito="fundacion" />, () =>
      falla ? errorApi(500, 'Falló') : respuestaJson(estadisticas()),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    falla = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('region', { name: 'Totales' })).toBeVisible();
    expect((sesion.valor as { cerrarSesion: () => void }).cerrarSesion).not.toHaveBeenCalled();
  });

  it('tras aplicar un filtro, el foco va al encabezado del resultado', async () => {
    montarPanel(<PantallaReportes ambito="fundacion" />, api());
    await screen.findByRole('region', { name: 'Totales' });
    await userEvent.click(screen.getByRole('button', { name: 'Este mes' }));
    const titulo = screen.getByRole('heading', { name: /Resultados/ });
    await waitFor(() => expect(titulo).toHaveFocus());
    expect(
      within(document.body).getByRole('heading', { level: 1, name: 'Reportes' }),
    ).toBeVisible();
  });
});
