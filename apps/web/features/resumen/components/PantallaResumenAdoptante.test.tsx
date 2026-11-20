import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorApi, montarPanel, respuestaJson, usuarioDe } from '@/shared/testing/prueba-utils';
import { paginaDe, seguimientoDe } from '../prueba-datos';
import { PantallaResumenAdoptante } from './PantallaResumenAdoptante';

vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
const sesion = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }));
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => sesion.valor }));

beforeEach(() => {
  sesion.valor = { estado: 'autenticado', usuario: usuarioDe('adoptante') };
});

const solicitud = (id: number, estado: string, nombre: string) => ({
  id,
  fechaSolicitud: '2026-11-02',
  estado,
  mascota: { id, nombre },
  fundacion: { nombre: 'Patitas' },
});
const adopcion = {
  id: 5,
  fechaEntrega: '2026-11-10',
  mascota: { id: 3, nombre: 'Rocky' },
  fundacion: { nombre: 'Huellas' },
};

function api(sobre: Record<string, () => Response> = {}) {
  return (ruta: string) => {
    for (const [prefijo, f] of Object.entries(sobre)) if (ruta.startsWith(prefijo)) return f();
    if (ruta.startsWith('/mis-solicitudes')) {
      return ruta.includes('estado=pendiente')
        ? respuestaJson(paginaDe([solicitud(1, 'pendiente', 'Luna')], 1))
        : respuestaJson(
            paginaDe([solicitud(1, 'pendiente', 'Luna'), solicitud(2, 'aprobada', 'Rocky')], 2),
          );
    }
    if (ruta.startsWith('/mis-adopciones')) return respuestaJson(paginaDe([adopcion], 1));
    if (ruta.startsWith('/mis-seguimientos')) {
      return ruta.includes('estado=vencido')
        ? respuestaJson(paginaDe([seguimientoDe({ id: 8, estado: 'vencido', vencido: true })], 1))
        : respuestaJson(
            paginaDe([
              seguimientoDe({ id: 9, fechaProgramada: '2026-12-20' }),
              seguimientoDe({ id: 10, fechaProgramada: '2026-12-22' }),
            ]),
          );
    }
    return respuestaJson({ noLeidas: 4 });
  };
}

describe('PantallaResumenAdoptante', () => {
  it('muestra un h1, las cifras, las filas con su estado en texto y los enlaces', async () => {
    montarPanel(<PantallaResumenAdoptante />, api());
    expect(screen.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible();
    const sol = await screen.findByRole('region', { name: 'Mis solicitudes' });
    await within(sol).findByText('Enviadas');
    expect(within(sol).getByText('Pendientes').parentElement).toHaveTextContent('1');
    expect(within(sol).getByRole('link', { name: /Solicitud de Luna.*Pendiente/ })).toHaveAttribute(
      'href',
      '/adoptante/solicitudes/1',
    );
    expect(within(sol).getByRole('link', { name: /Rocky.*Aprobada/ })).toBeVisible();

    const ado = await screen.findByRole('region', { name: 'Mis adopciones activas' });
    await within(ado).findByText(/Rocky/);
    expect(ado).toHaveTextContent('Huellas');
    expect(ado).toHaveTextContent('10 de noviembre de 2026');

    const seg = await screen.findByRole('region', { name: 'Seguimientos' });
    await within(seg).findByText('Vencidos');
    expect(within(seg).getByText('Vencidos').parentElement).toHaveTextContent('1');
    expect(within(seg).getByText('Programados').parentElement).toHaveTextContent('2');
    const filas = within(seg)
      .getAllByRole('link')
      .map((l) => l.getAttribute('href'));
    expect(filas.slice(0, 3)).toEqual([
      '/adoptante/adopciones/seguimientos/8',
      '/adoptante/adopciones/seguimientos/9',
      '/adoptante/adopciones/seguimientos/10',
    ]);

    const not = await screen.findByRole('region', { name: 'Notificaciones' });
    await within(not).findByText('4');
    expect(within(not).getByRole('link', { name: 'Ver mis notificaciones' })).toHaveAttribute(
      'href',
      '/adoptante/notificaciones',
    );
    expect(screen.getByRole('link', { name: 'Buscar mascotas' })).toHaveAttribute(
      'href',
      '/adoptar',
    );
    expect(screen.getByRole('link', { name: 'Donar a una fundación' })).toHaveAttribute(
      'href',
      '/adoptante/donar',
    );
    expect(document.body.textContent).not.toMatch(/próximamente|undefined|\[object|NaN/i);
  });

  it('muestra los estados vacíos con su acción', async () => {
    montarPanel(
      <PantallaResumenAdoptante />,
      api({
        '/mis-solicitudes': () => respuestaJson(paginaDe([], 0)),
        '/mis-adopciones': () => respuestaJson(paginaDe([], 0)),
        '/mis-seguimientos': () => respuestaJson(paginaDe([], 0)),
        '/notificaciones': () => respuestaJson({ noLeidas: 0 }),
      }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Aún no has enviado solicitudes' }),
    ).toBeVisible();
    expect(
      await screen.findByRole('heading', { name: 'Todavía no tienes adopciones activas' }),
    ).toBeVisible();
    expect(
      await screen.findByRole('heading', { name: 'No hay seguimientos pendientes' }),
    ).toBeVisible();
    expect(await screen.findByText('No tienes avisos pendientes.')).toBeVisible();
    expect(screen.getAllByRole('link', { name: 'Buscar mascotas' }).length).toBeGreaterThan(1);
  });

  it('un error parcial no tumba las demás tarjetas y permite reintentar', async () => {
    let fallar = true;
    montarPanel(
      <PantallaResumenAdoptante />,
      api({
        '/mis-adopciones': () =>
          fallar ? errorApi(500, 'Internal error') : respuestaJson(paginaDe([adopcion], 1)),
      }),
    );
    expect(
      await screen.findByRole('heading', { name: 'No pudimos cargar mis adopciones activas' }),
    ).toBeVisible();
    expect(await screen.findByRole('link', { name: /Solicitud de Luna/ })).toBeVisible();
    expect(screen.getByRole('alert')).not.toHaveTextContent(/Internal|Error:/);
    fallar = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(await screen.findByText(/Huellas/)).toBeVisible();
  });
});
