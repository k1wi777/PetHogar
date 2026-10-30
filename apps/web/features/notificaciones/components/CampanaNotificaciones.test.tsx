import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  errorApi,
  montarPanel,
  respuestaJson,
  usuarioDe,
  usuarioFundacion,
} from '@/shared/testing/prueba-utils';
import { aviso } from '@/shared/ui/Toaster';
import { notificacion, paginaDe } from '../prueba-datos';
import { CampanaNotificaciones, etiquetaNotificaciones } from './CampanaNotificaciones';

vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
const sesion = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }));
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => sesion.valor }));
vi.mock('@/shared/ui/Toaster', () => ({
  aviso: { error: vi.fn(), exito: vi.fn(), info: vi.fn() },
}));

interface Servidor {
  noLeidas: number | Response;
  lista: unknown[] | Response;
}

function montar(servidor: Servidor, rol: 'fundacion' | 'adoptante' = 'fundacion') {
  sesion.valor = {
    estado: 'autenticado',
    usuario: rol === 'fundacion' ? usuarioFundacion() : usuarioDe('adoptante'),
  };
  return montarPanel(<CampanaNotificaciones href={`/${rol}/notificaciones`} />, (ruta, init) => {
    if (ruta.startsWith('/notificaciones/no-leidas/count')) {
      return typeof servidor.noLeidas === 'number'
        ? respuestaJson({ noLeidas: servidor.noLeidas })
        : servidor.noLeidas;
    }
    if (ruta.startsWith('/notificaciones/leer-todas')) {
      const n = servidor.noLeidas;
      servidor.noLeidas = 0;
      return respuestaJson({ actualizadas: typeof n === 'number' ? n : 0 });
    }
    if (/^\/notificaciones\/\d+\/leida/.test(ruta) && init?.method === 'PATCH') {
      if (typeof servidor.noLeidas === 'number')
        servidor.noLeidas = Math.max(0, servidor.noLeidas - 1);
      return respuestaJson(notificacion());
    }
    if (ruta.startsWith('/notificaciones')) {
      return Array.isArray(servidor.lista)
        ? respuestaJson(paginaDe(servidor.lista as never))
        : servidor.lista;
    }
    return errorApi(404, 'nada');
  });
}

beforeEach(() => vi.clearAllMocks());

describe('CampanaNotificaciones: contador', () => {
  it('muestra el contador y lo incluye en el nombre accesible', async () => {
    montar({ noLeidas: 3, lista: [] });
    const boton = await screen.findByRole('button', { name: 'Notificaciones, 3 sin leer' });
    expect(boton).toHaveTextContent('3');
    expect(boton).toHaveAttribute('aria-expanded', 'false');
  });

  it('topa la burbuja en 99+ pero conserva la cantidad real en el nombre', async () => {
    montar({ noLeidas: 250, lista: [] });
    const boton = await screen.findByRole('button', { name: 'Notificaciones, 250 sin leer' });
    expect(boton).toHaveTextContent('99+');
  });

  it('con cero no muestra burbuja', async () => {
    montar({ noLeidas: 0, lista: [] });
    const boton = await screen.findByRole('button', { name: 'Notificaciones, ninguna sin leer' });
    expect(boton).not.toHaveTextContent(/\d/);
  });

  it('si el contador falla, muestra la campana sin cifra y sin cerrar la sesión', async () => {
    const { llamadas } = montar({ noLeidas: errorApi(500, 'caído'), lista: [] });
    await waitFor(() => expect(llamadas('/notificaciones/no-leidas/count')).toHaveLength(1));
    const boton = screen.getByRole('button', { name: 'Notificaciones' });
    expect(boton).not.toHaveTextContent(/\d/);
    expect(llamadas('/auth')).toHaveLength(0);
  });

  it('sin sesión autenticada no consulta', () => {
    sesion.valor = { estado: 'anonimo', usuario: null };
    const { llamadas } = montarPanel(<CampanaNotificaciones href="/x" />, () => errorApi(500, 'x'));
    expect(llamadas('/notificaciones')).toHaveLength(0);
  });

  it('etiquetaNotificaciones cubre los casos', () => {
    expect(etiquetaNotificaciones(undefined)).toBe('Notificaciones');
    expect(etiquetaNotificaciones(1)).toBe('Notificaciones, 1 sin leer');
  });
});

describe('CampanaNotificaciones: región aria-live', () => {
  it('está siempre en el DOM, educada, y solo anuncia cuando el contador aumenta', async () => {
    const servidor: Servidor = { noLeidas: 2, lista: [] };
    const { queryClient } = montar(servidor);
    const region = screen.getByTestId('anuncio-contador');
    expect(region).toHaveAttribute('aria-live', 'polite');
    await screen.findByRole('button', { name: 'Notificaciones, 2 sin leer' });
    expect(region).toBeEmptyDOMElement(); // primera carga: sin anuncio

    servidor.noLeidas = 1; // baja: sin anuncio
    await act(() => queryClient.invalidateQueries({ queryKey: ['notificaciones', 'no-leidas'] }));
    await screen.findByRole('button', { name: 'Notificaciones, 1 sin leer' });
    expect(region).toBeEmptyDOMElement();

    servidor.noLeidas = 4; // sube: anuncia
    await act(() => queryClient.invalidateQueries({ queryKey: ['notificaciones', 'no-leidas'] }));
    await waitFor(() => expect(region).toHaveTextContent('Tienes 3 notificaciones nuevas.'));
  });
});

describe('CampanaNotificaciones: menú', () => {
  const dos = [
    notificacion({ id: 1, titulo: 'Solicitud aprobada', leida: false }),
    notificacion({ id: 2, titulo: 'Ya vista', leida: true, referencia: null }),
  ];

  it('abre con clic, pasa el foco al título y muestra las recientes con su estado en texto', async () => {
    const u = userEvent.setup();
    montar({ noLeidas: 1, lista: dos });
    const boton = await screen.findByRole('button', { name: 'Notificaciones, 1 sin leer' });
    await u.click(boton);
    expect(boton).toHaveAttribute('aria-expanded', 'true');
    const panel = await screen.findByRole('region', { name: 'Notificaciones' });
    expect(boton).toHaveAttribute('aria-controls', panel.id);
    expect(within(panel).getByRole('heading', { name: 'Notificaciones' })).toHaveFocus();
    const lista = await within(panel).findByRole('list', { name: 'Notificaciones recientes' });
    expect(lista).toHaveTextContent('No leída. Solicitud aprobada');
    expect(lista).toHaveTextContent('Leída. Ya vista');
    expect(lista).toHaveTextContent('Nueva');
    expect(
      within(panel).getByRole('link', { name: 'Ver todas las notificaciones' }),
    ).toHaveAttribute('href', '/fundacion/notificaciones');
  });

  it('Escape lo cierra y devuelve el foco a la campana', async () => {
    const u = userEvent.setup();
    montar({ noLeidas: 1, lista: dos });
    const boton = await screen.findByRole('button', { name: 'Notificaciones, 1 sin leer' });
    await u.click(boton);
    await screen.findByRole('region', { name: 'Notificaciones' });
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Notificaciones' })).not.toBeInTheDocument();
    expect(boton).toHaveFocus();
    expect(boton).toHaveAttribute('aria-expanded', 'false');
  });

  it('el clic fuera lo cierra sin robar el foco', async () => {
    const u = userEvent.setup();
    montar({ noLeidas: 1, lista: dos });
    await u.click(await screen.findByRole('button', { name: 'Notificaciones, 1 sin leer' }));
    await screen.findByRole('region', { name: 'Notificaciones' });
    await u.click(document.body);
    expect(screen.queryByRole('region', { name: 'Notificaciones' })).not.toBeInTheDocument();
  });

  it('al sacar el foco del menú con Tab se cierra', async () => {
    const u = userEvent.setup();
    const externo = document.createElement('button');
    document.body.append(externo);
    montar({ noLeidas: 0, lista: [] });
    await u.click(await screen.findByRole('button', { name: 'Notificaciones, ninguna sin leer' }));
    await screen.findByRole('region', { name: 'Notificaciones' });
    externo.focus();
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Notificaciones' })).not.toBeInTheDocument(),
    );
    externo.remove();
  });

  it('se recorre solo con Tab: elementos, «Marcar todas» y «Ver todas»', async () => {
    const u = userEvent.setup();
    montar({ noLeidas: 1, lista: dos });
    await u.click(await screen.findByRole('button', { name: 'Notificaciones, 1 sin leer' }));
    const panel = await screen.findByRole('region', { name: 'Notificaciones' });
    await within(panel).findByRole('list');
    await u.tab();
    expect(within(panel).getByRole('link', { name: /Solicitud aprobada/ })).toHaveFocus();
    await u.tab();
    expect(within(panel).getByRole('button', { name: /Ya vista/ })).toHaveFocus();
    await u.tab();
    expect(within(panel).getByRole('button', { name: 'Marcar todas como leídas' })).toHaveFocus();
    await u.tab();
    expect(within(panel).getByRole('link', { name: 'Ver todas las notificaciones' })).toHaveFocus();
  });

  it('muestra estado vacío y estado de error con reintento sin cerrar sesión', async () => {
    const u = userEvent.setup();
    const servidor: Servidor = { noLeidas: 0, lista: errorApi(500, 'caído') };
    const { llamadas } = montar(servidor);
    await u.click(await screen.findByRole('button', { name: 'Notificaciones, ninguna sin leer' }));
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    servidor.lista = [];
    await u.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Todavía no tienes notificaciones.')).toBeInTheDocument();
    expect(llamadas('/auth')).toHaveLength(0);
  });

  it('abrir una no leída la marca y baja el contador, y cierra el menú', async () => {
    const u = userEvent.setup();
    const { llamadas } = montar({ noLeidas: 1, lista: dos });
    await u.click(await screen.findByRole('button', { name: 'Notificaciones, 1 sin leer' }));
    await u.click(await screen.findByRole('link', { name: /Solicitud aprobada/ }));
    await waitFor(() => expect(llamadas('/notificaciones/1/leida', 'PATCH')).toHaveLength(1));
    expect(screen.queryByRole('region', { name: 'Notificaciones' })).not.toBeInTheDocument();
    await screen.findByRole('button', { name: 'Notificaciones, ninguna sin leer' });
  });

  it('un adoptante abre una solicitud hacia su propia ruta, nunca la de la fundación', async () => {
    const u = userEvent.setup();
    montar({ noLeidas: 1, lista: dos }, 'adoptante');
    await u.click(await screen.findByRole('button', { name: 'Notificaciones, 1 sin leer' }));
    expect(await screen.findByRole('link', { name: /Solicitud aprobada/ })).toHaveAttribute(
      'href',
      '/adoptante/solicitudes/4',
    );
  });

  it('el enlace al destino existe desde el primer instante y, si marcar falla, avisa sin bloquear', async () => {
    const u = userEvent.setup();
    montarPanel(<CampanaNotificaciones href="/x" />, (ruta, init) => {
      if (ruta.startsWith('/notificaciones/no-leidas')) return respuestaJson({ noLeidas: 1 });
      if (init?.method === 'PATCH') return errorApi(500, 'caído');
      return respuestaJson(paginaDe([notificacion({ id: 9 })]));
    });
    sesion.valor = { estado: 'autenticado', usuario: usuarioFundacion() };
    await u.click(await screen.findByRole('button', { name: /Notificaciones/ }));
    const enlace = await screen.findByRole('link', { name: /Solicitud aprobada/ });
    expect(enlace).toHaveAttribute('href', '/fundacion/solicitudes/4');
    await u.click(enlace);
    await waitFor(() =>
      expect(aviso.error).toHaveBeenCalledWith('No pudimos marcar la notificación como leída.'),
    );
    // El menú ya se cerró: la navegación no esperó al servidor.
    expect(screen.queryByRole('region', { name: 'Notificaciones' })).not.toBeInTheDocument();
  });

  it('«Marcar todas» deja el contador en 0 y confirma con una región de estado', async () => {
    const u = userEvent.setup();
    montar({ noLeidas: 2, lista: dos });
    await u.click(await screen.findByRole('button', { name: 'Notificaciones, 2 sin leer' }));
    await u.click(await screen.findByRole('button', { name: 'Marcar todas como leídas' }));
    expect(await screen.findByText('Marcamos 2 notificaciones como leídas.')).toBeInTheDocument();
    await screen.findByRole('button', { name: 'Notificaciones, ninguna sin leer' });
  });

  it('muestra el HTML del mensaje como texto, sin interpretarlo', async () => {
    const u = userEvent.setup();
    montar({
      noLeidas: 1,
      lista: [notificacion({ mensaje: '<img src=x onerror=alert(1)>', titulo: '<b>Hola</b>' })],
    });
    await u.click(await screen.findByRole('button', { name: /Notificaciones/ }));
    const panel = await screen.findByRole('region', { name: 'Notificaciones' });
    expect(await within(panel).findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(panel.querySelector('img')).toBeNull();
    expect(panel.querySelector('b')).toBeNull();
  });
});
