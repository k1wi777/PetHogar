import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  errorApi,
  montarPanel,
  respuestaJson,
  usuarioFundacion,
} from '@/shared/testing/prueba-utils';
import { paginaDe, seguimientoDe } from '../prueba-datos';
import { PantallaResumenFundacion } from './PantallaResumenFundacion';

vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
const sesion = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }));
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => sesion.valor }));

function ponerSesion(estado: 'pendiente' | 'aprobada' | 'rechazada') {
  sesion.valor = {
    estado: 'autenticado',
    usuario: usuarioFundacion(estado),
    refrescarPerfil: vi.fn(),
  };
}
beforeEach(() => ponerSesion('aprobada'));

const TOTALES = { economica: { cantidad: 2, monto: '150000.50' }, especie: { cantidad: 1 } };
const donacion = {
  id: 1,
  tipo: 'economica',
  monto: '100000.00',
  descripcionEspecie: null,
  fecha: '2026-11-05T15:00:00.000Z',
  donante: { nombre: 'María Gómez' },
};

function api(sobre: Record<string, () => Response> = {}) {
  return (ruta: string) => {
    for (const [prefijo, f] of Object.entries(sobre)) if (ruta.startsWith(prefijo)) return f();
    if (ruta.startsWith('/fundacion/mascotas')) {
      const total = { disponible: 5, en_proceso: 2, adoptada: 7, inactiva: 0 }[
        /estado=(\w+)/.exec(ruta)![1] as 'disponible'
      ];
      return respuestaJson(paginaDe([], total));
    }
    if (ruta.startsWith('/fundacion/solicitudes')) {
      return respuestaJson(
        paginaDe(
          [
            {
              id: 4,
              fechaSolicitud: '2026-11-03',
              estado: 'pendiente',
              mascota: { id: 7, nombre: 'Luna' },
              adoptante: { nombreCompleto: 'Ana Pérez' },
            },
          ],
          6,
        ),
      );
    }
    if (ruta.startsWith('/fundacion/seguimientos')) {
      return ruta.includes('estado=vencido')
        ? respuestaJson(paginaDe([], 0))
        : respuestaJson(paginaDe([seguimientoDe({ id: 3, adoptante: { nombreCompleto: 'Ana' } })]));
    }
    if (ruta.startsWith('/fundacion/donaciones')) {
      return respuestaJson({ ...paginaDe([donacion], 3), totales: TOTALES });
    }
    return respuestaJson({ noLeidas: 1 });
  };
}

describe('PantallaResumenFundacion', () => {
  it('muestra mascotas por estado enlazadas, solicitudes, seguimientos y donaciones del mes', async () => {
    const { llamadas } = montarPanel(<PantallaResumenFundacion />, api());
    expect(screen.getByRole('heading', { level: 1, name: 'Resumen' })).toBeVisible();

    const mas = await screen.findByRole('region', { name: 'Mis mascotas' });
    const enlace = await within(mas).findByRole('link', { name: /Disponibles\s*5/ });
    expect(enlace).toHaveAttribute('href', '/fundacion/mascotas?estado=disponible');
    expect(within(mas).getByRole('link', { name: /Adoptadas\s*7/ })).toHaveAttribute(
      'href',
      '/fundacion/mascotas?estado=adoptada',
    );
    expect(llamadas('/fundacion/mascotas')).toHaveLength(4);

    const sol = await screen.findByRole('region', { name: 'Solicitudes pendientes' });
    expect(await within(sol).findByText('6')).toBeVisible();
    expect(
      within(sol).getByRole('link', { name: /Solicitud para Luna.*Pendiente/ }),
    ).toHaveAttribute('href', '/fundacion/solicitudes/4');

    const seg = await screen.findByRole('region', { name: 'Seguimientos' });
    expect(await within(seg).findByRole('link', { name: /Luna/ })).toHaveAttribute(
      'href',
      '/fundacion/adopciones/seguimientos/3',
    );

    const don = await screen.findByRole('region', { name: 'Donaciones del mes' });
    await within(don).findByText('Total económico');
    expect(don).toHaveTextContent('$ 150.000,50');
    expect(don).toHaveTextContent('María Gómez');
    expect(don).toHaveTextContent('Económica $ 100.000');

    expect(screen.getByRole('link', { name: 'Publicar mascota' })).toHaveAttribute(
      'href',
      '/fundacion/mascotas/nueva',
    );
    expect(screen.getByRole('link', { name: 'Registrar donación' })).toHaveAttribute(
      'href',
      '/fundacion/donaciones/nueva',
    );
    expect(document.body.textContent).not.toMatch(/próximamente|undefined|\[object|NaN/i);
  });

  it('con la fundación pendiente muestra el aviso y no lanza peticiones', () => {
    ponerSesion('pendiente');
    const { fetchImpl } = montarPanel(<PantallaResumenFundacion />, api());
    expect(screen.getByRole('heading', { level: 1, name: 'Resumen' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Tu fundación aún no está aprobada');
    expect(screen.getByRole('button', { name: 'Actualizar mi estado' })).toBeVisible();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('con la fundación rechazada muestra el aviso de rechazo y no lanza peticiones', () => {
    ponerSesion('rechazada');
    sesion.valor = {
      ...sesion.valor,
      usuario: usuarioFundacion('rechazada', 'Falta el documento legal'),
    };
    const { fetchImpl } = montarPanel(<PantallaResumenFundacion />, api());
    expect(screen.getByRole('status')).toHaveTextContent(
      'La validación de tu fundación fue rechazada',
    );
    expect(screen.getByRole('status')).toHaveTextContent('Falta el documento legal');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('muestra vacíos con su acción', async () => {
    montarPanel(
      <PantallaResumenFundacion />,
      api({
        '/fundacion/mascotas': () => respuestaJson(paginaDe([], 0)),
        '/fundacion/solicitudes': () => respuestaJson(paginaDe([], 0)),
        '/fundacion/seguimientos': () => respuestaJson(paginaDe([], 0)),
        '/fundacion/donaciones': () => respuestaJson({ ...paginaDe([], 0), totales: TOTALES }),
      }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Aún no has publicado mascotas' }),
    ).toBeVisible();
    expect(
      await screen.findByRole('heading', { name: 'No tienes solicitudes por revisar' }),
    ).toBeVisible();
    expect(
      await screen.findByRole('heading', { name: 'Este mes aún no hay donaciones' }),
    ).toBeVisible();
  });

  it('un error en donaciones no oculta las demás tarjetas', async () => {
    montarPanel(
      <PantallaResumenFundacion />,
      api({ '/fundacion/donaciones': () => errorApi(429, 'Too Many Requests') }),
    );
    expect(
      await screen.findByRole('heading', { name: 'No pudimos cargar donaciones del mes' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    expect(await screen.findByRole('link', { name: /Solicitud para Luna/ })).toBeVisible();
  });
});
