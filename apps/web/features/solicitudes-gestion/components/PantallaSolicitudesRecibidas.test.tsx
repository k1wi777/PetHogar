import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  errorApi,
  montarPanel,
  respuestaJson,
  usuarioFundacion,
} from '@/shared/testing/prueba-utils';
import { pagina, resumen } from '../prueba-datos';
import { PantallaSolicitudesRecibidas } from './PantallaSolicitudesRecibidas';

let consulta = '';
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(consulta),
  useRouter: () => ({ push }),
  usePathname: () => '/fundacion/solicitudes',
}));
vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
const sesion = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }));
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => sesion.valor }));

function ponerSesion(u = usuarioFundacion('aprobada')) {
  sesion.valor = {
    estado: 'autenticado',
    usuario: u,
    refrescarPerfil: vi.fn(),
    cerrarSesion: vi.fn(),
  };
}
beforeEach(() => {
  consulta = '';
  push.mockClear();
  ponerSesion();
});

const mascotas = () =>
  respuestaJson(
    pagina([
      { id: 7, nombre: 'Luna' },
      { id: 8, nombre: 'Rocky' },
    ]),
  );

describe('PantallaSolicitudesRecibidas', () => {
  it('lista mascota, adoptante, fecha y estado en texto con el acceso a revisar', async () => {
    montarPanel(<PantallaSolicitudesRecibidas />, (ruta) =>
      ruta.startsWith('/fundacion/mascotas')
        ? mascotas()
        : respuestaJson(
            pagina([
              resumen({ id: 1 }),
              resumen({
                id: 2,
                estado: 'rechazada',
                mascota: { id: 8, nombre: 'Rocky' },
                adoptante: { nombreCompleto: 'Luis Gómez' },
              }),
            ]),
          ),
    );
    const lista = await screen.findByRole('list', { name: 'Solicitudes recibidas' });
    const filas = within(lista).getAllByRole('listitem');
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent('Luna');
    expect(filas[0]).toHaveTextContent('Ana Pérez');
    expect(filas[0]).toHaveTextContent('2 de noviembre de 2026');
    expect(filas[0]).toHaveTextContent('Pendiente');
    expect(filas[1]).toHaveTextContent('Rechazada');
    expect(
      within(filas[1]!).getByRole('link', {
        name: 'Revisar la solicitud de Luis Gómez para Rocky',
      }),
    ).toHaveAttribute('href', '/fundacion/solicitudes/2');
  });

  it('los filtros combinados de la URL viajan a la API y los enlaces los conservan', async () => {
    consulta = 'estado=pendiente&mascota=7&pagina=2';
    const { llamadas } = montarPanel(<PantallaSolicitudesRecibidas />, (ruta) =>
      ruta.startsWith('/fundacion/mascotas')
        ? mascotas()
        : respuestaJson(pagina([resumen()], { total: 11, page: 2 })),
    );
    const lista = await screen.findByRole('list', { name: 'Solicitudes recibidas' });
    const url = llamadas('/fundacion/solicitudes')[0]![0];
    expect(url).toContain('estado=pendiente');
    expect(url).toContain('mascotaId=7');
    expect(url).toContain('page=2');
    expect(within(lista).getByRole('link')).toHaveAttribute(
      'href',
      '/fundacion/solicitudes/1?estado=pendiente&mascota=7&pagina=2',
    );
    expect(screen.getByText(/Página 2 de 2/)).toBeInTheDocument();
  });

  it('cambiar el estado vuelve a la página 1 y conserva la mascota; la paginación conserva los filtros', async () => {
    consulta = 'mascota=7&pagina=2';
    montarPanel(<PantallaSolicitudesRecibidas />, (ruta) =>
      ruta.startsWith('/fundacion/mascotas')
        ? mascotas()
        : respuestaJson(pagina([resumen()], { total: 25, page: 2 })),
    );
    await screen.findByRole('list', { name: 'Solicitudes recibidas' });
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(push).toHaveBeenLastCalledWith('/fundacion/solicitudes?mascota=7');
    await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar por estado' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Aprobada' }));
    expect(push).toHaveBeenLastCalledWith('/fundacion/solicitudes?estado=aprobada&mascota=7');
  });

  it('elegir una mascota en el selector filtra por su id', async () => {
    montarPanel(<PantallaSolicitudesRecibidas />, (ruta) =>
      ruta.startsWith('/fundacion/mascotas') ? mascotas() : respuestaJson(pagina([resumen()])),
    );
    await screen.findByRole('list', { name: 'Solicitudes recibidas' });
    await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar por mascota' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Rocky' }));
    expect(push).toHaveBeenLastCalledWith('/fundacion/solicitudes?mascota=8');
  });

  it('vacío sin filtros explica y vacío con filtros ofrece quitarlos', async () => {
    montarPanel(<PantallaSolicitudesRecibidas />, (ruta) =>
      ruta.startsWith('/fundacion/mascotas') ? mascotas() : respuestaJson(pagina([])),
    );
    expect(await screen.findByText('Aún no recibes solicitudes')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar filtros' })).toBeNull();
  });

  it('vacío con filtros: «Quitar filtros» limpia la URL', async () => {
    consulta = 'estado=aprobada';
    montarPanel(<PantallaSolicitudesRecibidas />, (ruta) =>
      ruta.startsWith('/fundacion/mascotas') ? mascotas() : respuestaJson(pagina([])),
    );
    expect(await screen.findByText('No hay solicitudes con esos filtros')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    expect(push).toHaveBeenLastCalledWith('/fundacion/solicitudes');
  });

  it('una mascota de la URL fuera del selector se conserva como «Mascota #id»', async () => {
    consulta = 'mascota=99';
    montarPanel(<PantallaSolicitudesRecibidas />, (ruta) =>
      ruta.startsWith('/fundacion/mascotas') ? mascotas() : respuestaJson(pagina([])),
    );
    await screen.findByText('No hay solicitudes con esos filtros');
    expect(screen.getByRole('combobox', { name: 'Filtrar por mascota' })).toHaveTextContent(
      'Mascota #99',
    );
  });

  it('con error ofrece «Reintentar» sin cerrar la sesión', async () => {
    let falla = true;
    montarPanel(<PantallaSolicitudesRecibidas />, (ruta) => {
      if (ruta.startsWith('/fundacion/mascotas')) return mascotas();
      return falla ? errorApi(429, 'Demasiadas') : respuestaJson(pagina([resumen()]));
    });
    expect(await screen.findByText('No pudimos cargar esta información')).toBeInTheDocument();
    falla = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('list', { name: 'Solicitudes recibidas' })).toBeInTheDocument();
    expect((sesion.valor.cerrarSesion as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it('con la fundación pendiente muestra el motivo y no lanza peticiones', async () => {
    ponerSesion(usuarioFundacion('pendiente'));
    const { fetchImpl } = montarPanel(<PantallaSolicitudesRecibidas />, () => respuestaJson({}));
    expect(await screen.findByText('Tu fundación aún no está aprobada')).toBeInTheDocument();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('un 403 a mitad de sesión muestra el aviso con el mensaje del servidor', async () => {
    montarPanel(<PantallaSolicitudesRecibidas />, (ruta) =>
      ruta.startsWith('/fundacion/mascotas')
        ? mascotas()
        : errorApi(403, 'Tu fundación fue suspendida'),
    );
    expect(await screen.findByText('Tu fundación fue suspendida')).toBeInTheDocument();
  });
});
