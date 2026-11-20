import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorApi, montarPanel, respuestaJson, usuarioDe } from '@/shared/testing/prueba-utils';
import { paginaDe } from '../prueba-datos';
import { PantallaResumenAdministrador } from './PantallaResumenAdministrador';

vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
const sesion = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }));
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => sesion.valor }));

beforeEach(() => {
  sesion.valor = { estado: 'autenticado', usuario: usuarioDe('administrador') };
});

const ESTADISTICAS = {
  adopciones: { total: 12 },
  solicitudes: { total: 40, porEstado: { pendiente: 9 } },
  seguimientos: { porEstado: { vencido: 3 } },
  donaciones: { total: 8, porTipo: { economica: { monto: '2500000.00' } } },
};

function api(sobre: Record<string, () => Response> = {}) {
  return (ruta: string) => {
    for (const [prefijo, f] of Object.entries(sobre)) if (ruta.startsWith(prefijo)) return f();
    if (ruta.startsWith('/admin/fundaciones')) {
      return respuestaJson(
        paginaDe([{ id: 11, nombre: 'Patitas del Sinú', ciudad: 'Montería' }], 4),
      );
    }
    if (ruta.startsWith('/admin/estadisticas')) return respuestaJson(ESTADISTICAS);
    return respuestaJson({ noLeidas: 2 });
  };
}

describe('PantallaResumenAdministrador', () => {
  it('muestra fundaciones por validar enlazadas, el extracto de estadísticas y el contador', async () => {
    const { llamadas } = montarPanel(<PantallaResumenAdministrador />, api());
    expect(screen.getByRole('heading', { level: 1, name: 'Resumen' })).toBeVisible();

    const fun = await screen.findByRole('region', { name: 'Fundaciones por validar' });
    expect(await within(fun).findByText('4')).toBeVisible();
    expect(
      within(fun).getByRole('link', { name: /Fundación Patitas del Sinú.*Pendiente/ }),
    ).toHaveAttribute('href', '/administrador/fundaciones/11');
    expect(llamadas('/admin/fundaciones')[0]![0]).toContain('estado=pendiente');

    const est = await screen.findByRole('region', { name: 'Estadísticas de la plataforma' });
    await within(est).findByText('Adopciones');
    expect(within(est).getByText('Adopciones').parentElement).toHaveTextContent('12');
    expect(within(est).getByText('Solicitudes pendientes').parentElement).toHaveTextContent('9');
    expect(within(est).getByText('Seguimientos vencidos').parentElement).toHaveTextContent('3');
    expect(est).toHaveTextContent('$ 2.500.000');
    expect(within(est).getByRole('link', { name: 'Ver reportes y gráficas' })).toHaveAttribute(
      'href',
      '/administrador/reportes',
    );

    const not = await screen.findByRole('region', { name: 'Notificaciones' });
    expect(await within(not).findByText('2')).toBeVisible();
    expect(document.body.textContent).not.toMatch(/próximamente|undefined|\[object|NaN/i);
  });

  it('muestra el vacío si no hay fundaciones por validar', async () => {
    montarPanel(
      <PantallaResumenAdministrador />,
      api({ '/admin/fundaciones': () => respuestaJson(paginaDe([], 0)) }),
    );
    expect(
      await screen.findByRole('heading', { name: 'No hay fundaciones por validar' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Ver fundaciones' })).toHaveAttribute(
      'href',
      '/administrador/fundaciones',
    );
  });

  it('un error en estadísticas deja las demás tarjetas y permite reintentar', async () => {
    let fallar = true;
    montarPanel(
      <PantallaResumenAdministrador />,
      api({
        '/admin/estadisticas': () =>
          fallar ? errorApi(500, 'Internal') : respuestaJson(ESTADISTICAS),
      }),
    );
    expect(
      await screen.findByRole('heading', {
        name: 'No pudimos cargar estadísticas de la plataforma',
      }),
    ).toBeVisible();
    expect(await screen.findByRole('link', { name: /Patitas del Sinú/ })).toBeVisible();
    fallar = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Monto económico')).toBeVisible();
  });
});
