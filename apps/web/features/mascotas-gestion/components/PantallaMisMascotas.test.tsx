import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorApi, montarPanel, respuestaJson } from '@/shared/testing/prueba-utils';
import { fundacion, mascota } from '../prueba-datos';
import { PantallaMisMascotas } from './PantallaMisMascotas';

let consulta = '';
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(consulta),
  useRouter: () => ({ push }),
  usePathname: () => '/fundacion/mascotas',
}));
vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
const sesion = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }));
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => sesion.valor }));

const refrescarPerfil = vi.fn();
function ponerSesion(u = fundacion('aprobada')) {
  sesion.valor = { estado: 'autenticado', usuario: u, refrescarPerfil, cerrarSesion: vi.fn() };
}

beforeEach(() => {
  consulta = '';
  push.mockClear();
  ponerSesion();
});

const pagina = (data: unknown[], total = data.length, page = 1) =>
  respuestaJson({ total, page, limit: 10, data });

describe('PantallaMisMascotas', () => {
  it('lista nombre, estado en texto, edad, tamaño y sexo, con el acceso a publicar', async () => {
    montarPanel(<PantallaMisMascotas />, () =>
      pagina([
        mascota({ id: 1, nombre: 'Firulais', estado: 'disponible' }),
        mascota({
          id: 2,
          nombre: 'Michi',
          estado: 'en_proceso',
          sexo: 'hembra',
          tamano: 'pequeño',
          edadMeses: 8,
        }),
      ]),
    );
    const lista = await screen.findByRole('list', { name: 'Mascotas' });
    const filas = within(lista).getAllByRole('listitem');
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent('Firulais');
    expect(filas[0]).toHaveTextContent('Disponible');
    expect(filas[0]).toHaveTextContent('2 años · Mediano · Macho');
    expect(filas[1]).toHaveTextContent('En proceso');
    expect(filas[1]).toHaveTextContent('8 meses · Pequeño · Hembra');
    expect(screen.getByRole('link', { name: 'Publicar mascota' })).toHaveAttribute(
      'href',
      '/fundacion/mascotas/nueva',
    );
    expect(screen.getByRole('link', { name: 'Gestionar a Michi' })).toHaveAttribute(
      'href',
      '/fundacion/mascotas/2',
    );
  });

  it('pide página y estado de la URL, y los conserva en el enlace a la ficha', async () => {
    consulta = 'pagina=2&estado=inactiva';
    const { llamadas } = montarPanel(<PantallaMisMascotas />, () =>
      pagina([mascota({ estado: 'inactiva' })], 11, 2),
    );
    await screen.findByRole('list', { name: 'Mascotas' });
    const [url] = llamadas('/fundacion/mascotas')[0]!;
    expect(url).toContain('page=2');
    expect(url).toContain('estado=inactiva');
    expect(screen.getByRole('link', { name: /Gestionar a/ })).toHaveAttribute(
      'href',
      '/fundacion/mascotas/5?pagina=2&estado=inactiva',
    );
    expect(screen.getByRole('combobox', { name: 'Estado' })).toHaveTextContent('Inactiva');
  });

  it('un estado inválido en la URL se ignora (todas)', async () => {
    consulta = 'estado=raro';
    const { llamadas } = montarPanel(<PantallaMisMascotas />, () => pagina([mascota()]));
    await screen.findByRole('list', { name: 'Mascotas' });
    expect(llamadas('/fundacion/mascotas')[0]![0]).not.toContain('estado=');
    expect(screen.getByRole('combobox', { name: 'Estado' })).toHaveTextContent('Todas');
  });

  it('cambiar el filtro vuelve a la página 1 en la URL', async () => {
    consulta = 'pagina=3';
    montarPanel(<PantallaMisMascotas />, () => pagina([mascota()], 30, 3));
    await screen.findByRole('list', { name: 'Mascotas' });
    const combo = screen.getByRole('combobox', { name: 'Estado' });
    combo.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.click(await screen.findByRole('option', { name: 'Adoptada' }));
    expect(push).toHaveBeenCalledWith('/fundacion/mascotas?estado=adoptada');
  });

  it('pagina con los botones', async () => {
    montarPanel(<PantallaMisMascotas />, () => pagina([mascota()], 25));
    await screen.findByRole('list', { name: 'Mascotas' });
    expect(screen.getByText(/Página 1 de 3/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(push).toHaveBeenCalledWith('/fundacion/mascotas?pagina=2');
  });

  it('sin mascotas invita a publicar la primera', async () => {
    montarPanel(<PantallaMisMascotas />, () => pagina([]));
    expect(await screen.findByText('Aún no has publicado mascotas')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Publicar mi primera mascota' })).toHaveAttribute(
      'href',
      '/fundacion/mascotas/nueva',
    );
  });

  it('sin resultados con filtro ofrece «Ver todas»', async () => {
    consulta = 'estado=adoptada';
    montarPanel(<PantallaMisMascotas />, () => pagina([]));
    expect(await screen.findByText('No hay mascotas con este estado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver todas' }));
    expect(push).toHaveBeenCalledWith('/fundacion/mascotas');
  });

  it('muestra un esqueleto mientras carga', () => {
    montarPanel(<PantallaMisMascotas />, () => new Promise<Response>(() => {}));
    expect(screen.getByText('Cargando tus mascotas…')).toBeInTheDocument();
  });

  it('si la API falla muestra un error amable y «Reintentar» sin tocar la sesión', async () => {
    let falla = true;
    const { llamadas } = montarPanel(<PantallaMisMascotas />, () =>
      falla ? errorApi(500, 'x') : pagina([mascota()]),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar');
    falla = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('list', { name: 'Mascotas' })).toBeInTheDocument();
    expect(llamadas('/fundacion/mascotas')).toHaveLength(2);
    expect(sesion.valor.cerrarSesion).not.toHaveBeenCalled();
  });

  it.each([
    ['pendiente', null, /aún no está aprobada/],
    ['rechazada', 'Falta el RUT legible', /Falta el RUT legible/],
  ] as const)(
    'fundación %s: muestra el motivo y NO lanza peticiones',
    async (estado, observacion, texto) => {
      ponerSesion(fundacion(estado, observacion));
      const { llamadas, fetchImpl } = montarPanel(<PantallaMisMascotas />, () => pagina([]));
      expect(await screen.findByRole('status')).toHaveTextContent(texto);
      expect(screen.queryByRole('link', { name: 'Publicar mascota' })).toBeNull();
      expect(llamadas('/fundacion/mascotas')).toHaveLength(0);
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('un 403 a mitad de sesión muestra el mensaje del servidor y mantiene la sesión', async () => {
    montarPanel(<PantallaMisMascotas />, () =>
      errorApi(403, 'Tu fundación fue rechazada; revisa la observación del administrador'),
    );
    expect(await screen.findByText('Tu fundación aún no está aprobada')).toBeInTheDocument();
    expect(
      screen.getByText('Tu fundación fue rechazada; revisa la observación del administrador'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar mi estado' }));
    expect(refrescarPerfil).toHaveBeenCalledTimes(1);
    expect(sesion.valor.cerrarSesion).not.toHaveBeenCalled();
  });
});
