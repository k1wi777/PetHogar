import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorApi, montarPanel, respuestaJson, usuarioDe } from '@/shared/testing/prueba-utils';
import { notificacion, paginaDe } from '../prueba-datos';
import { PantallaNotificaciones } from './PantallaNotificaciones';

let consulta = '';
const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(consulta),
  useRouter: () => ({ push, replace }),
  usePathname: () => '/adoptante/notificaciones',
}));
vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
const sesion = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }));
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => sesion.valor }));
vi.mock('@/shared/ui/Toaster', () => ({
  aviso: { error: vi.fn(), exito: vi.fn(), info: vi.fn() },
}));

beforeEach(() => {
  consulta = '';
  vi.clearAllMocks();
  sesion.valor = { estado: 'autenticado', usuario: usuarioDe('adoptante') };
});

const tres = [
  notificacion({
    id: 3,
    titulo: 'Seguimiento próximo',
    referencia: { tipo: 'seguimiento', id: 9 },
  }),
  notificacion({ id: 2, titulo: 'Solicitud aprobada', leida: true }),
  notificacion({ id: 1, titulo: 'Gracias por donar', referencia: { tipo: 'donacion', id: 5 } }),
];

describe('PantallaNotificaciones', () => {
  it('lista de la más reciente a la más antigua con el estado en texto y enlaces a su pantalla', async () => {
    montarPanel(<PantallaNotificaciones />, () => respuestaJson(paginaDe(tres)));
    const lista = await screen.findByRole('list', { name: 'Notificaciones' });
    const items = within(lista).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('No leída. Seguimiento próximo');
    expect(items[0]).toHaveTextContent('Nueva');
    expect(items[1]).toHaveTextContent('Leída. Solicitud aprobada');
    expect(within(items[1]!).queryByText('Nueva')).not.toBeInTheDocument();
    expect(within(items[0]!).getByRole('link')).toHaveAttribute(
      'href',
      '/adoptante/adopciones/seguimientos/9',
    );
    // Donación del donante: no hay pantalla de historial → solo se marca (un botón, no un enlace).
    expect(within(items[2]!).getByRole('button')).toBeInTheDocument();
  });

  it('pide la página y el filtro de la URL', async () => {
    consulta = 'leida=false&pagina=2';
    const { llamadas } = montarPanel(<PantallaNotificaciones />, () =>
      respuestaJson(paginaDe(tres, { total: 25, page: 2 })),
    );
    await screen.findByRole('list', { name: 'Notificaciones' });
    expect(llamadas('/notificaciones?page=2&limit=10&leida=false')).toHaveLength(1);
  });

  it('normaliza parámetros inválidos a la vista por defecto', async () => {
    consulta = 'leida=quizas&pagina=-4';
    const { llamadas } = montarPanel(<PantallaNotificaciones />, () =>
      respuestaJson(paginaDe(tres)),
    );
    await screen.findByRole('list', { name: 'Notificaciones' });
    expect(llamadas('/notificaciones?page=1&limit=10')).toHaveLength(1);
  });

  it('cambiar el filtro actualiza la URL y vuelve a la página 1', async () => {
    const u = userEvent.setup();
    consulta = 'pagina=3';
    montarPanel(<PantallaNotificaciones />, () =>
      respuestaJson(paginaDe(tres, { total: 30, page: 3 })),
    );
    await screen.findByRole('list', { name: 'Notificaciones' });
    await u.click(screen.getByRole('combobox'));
    await u.click(await screen.findByRole('option', { name: 'No leídas' }));
    expect(push).toHaveBeenCalledWith('/adoptante/notificaciones?leida=false');
  });

  it('paginar escribe la página en la URL conservando el filtro', async () => {
    const u = userEvent.setup();
    consulta = 'leida=true';
    montarPanel(<PantallaNotificaciones />, () => respuestaJson(paginaDe(tres, { total: 25 })));
    await screen.findByRole('list', { name: 'Notificaciones' });
    await u.click(screen.getByRole('button', { name: /siguiente/i }));
    expect(push).toHaveBeenCalledWith('/adoptante/notificaciones?leida=true&pagina=2');
  });

  it.each([
    ['', 'Todavía no tienes notificaciones'],
    ['leida=false', 'No tienes notificaciones sin leer'],
    ['leida=true', 'No tienes notificaciones leídas'],
  ])('vacío (%s): «%s»', async (c, titulo) => {
    consulta = c;
    montarPanel(<PantallaNotificaciones />, () => respuestaJson(paginaDe([])));
    expect(await screen.findByRole('heading', { name: titulo })).toBeInTheDocument();
  });

  it('error con reintento que no cierra la sesión', async () => {
    const u = userEvent.setup();
    let falla = true;
    const { llamadas } = montarPanel(<PantallaNotificaciones />, () =>
      falla ? errorApi(500, 'caído') : respuestaJson(paginaDe(tres)),
    );
    await u.click(await screen.findByRole('button', { name: 'Reintentar' }));
    falla = false;
    await u.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByRole('list', { name: 'Notificaciones' });
    expect(llamadas('/auth')).toHaveLength(0);
  });

  it('muestra el HTML del servidor como texto', async () => {
    montarPanel(<PantallaNotificaciones />, () =>
      respuestaJson(
        paginaDe([
          notificacion({ mensaje: '<img src=x onerror=alert(1)>', titulo: '<script>x</script>' }),
        ]),
      ),
    );
    const lista = await screen.findByRole('list', { name: 'Notificaciones' });
    expect(lista).toHaveTextContent('<img src=x onerror=alert(1)>');
    expect(lista.querySelector('img')).toBeNull();
    expect(lista.querySelector('script')).toBeNull();
  });

  it('abrir una no leída la marca por PATCH (y 404 se ignora sin error)', async () => {
    const u = userEvent.setup();
    const { llamadas } = montarPanel(<PantallaNotificaciones />, (ruta, init) =>
      init?.method === 'PATCH' ? errorApi(404, 'No existe') : respuestaJson(paginaDe(tres)),
    );
    await u.click(await screen.findByRole('link', { name: /Seguimiento próximo/ }));
    await waitFor(() => expect(llamadas('/notificaciones/3/leida', 'PATCH')).toHaveLength(1));
    // 404 silencioso: la lista se vuelve a pedir y no hay aviso de error.
    await waitFor(() => expect(llamadas('/notificaciones?', 'GET').length).toBeGreaterThan(1));
  });

  it('«Marcar todas» confirma y refresca; con la última página vacía retrocede', async () => {
    const u = userEvent.setup();
    consulta = 'leida=false&pagina=2';
    let marcadas = false;
    const { llamadas } = montarPanel(<PantallaNotificaciones />, (ruta, init) => {
      if (init?.method === 'PATCH') {
        marcadas = true;
        return respuestaJson({ actualizadas: 11 });
      }
      return marcadas
        ? respuestaJson(paginaDe([], { total: 0, page: 2 }))
        : respuestaJson(paginaDe(tres, { total: 13, page: 2 }));
    });
    await screen.findByRole('list', { name: 'Notificaciones' });
    await u.click(screen.getByRole('button', { name: 'Marcar todas como leídas' }));
    expect(await screen.findByText('Marcamos 11 notificaciones como leídas.')).toBeInTheDocument();
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/adoptante/notificaciones?leida=false'),
    );
    expect(llamadas('/notificaciones/leer-todas', 'PATCH')).toHaveLength(1);
  });
});
