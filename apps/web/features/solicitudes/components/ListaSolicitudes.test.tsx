import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorApi, montarPanel, respuestaJson } from '@/shared/testing/prueba-utils';
import { resumen } from '../prueba-datos';
import { ListaSolicitudes } from './ListaSolicitudes';

let consulta = '';
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(consulta),
  useRouter: () => ({ push }),
  usePathname: () => '/adoptante/solicitudes',
}));
vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
const reintentarSesion = vi.fn();
vi.mock('@/shared/auth/SesionProvider', () => ({
  useSesion: () => ({ estado: 'autenticado', usuario: null, cerrarSesion: reintentarSesion }),
}));

beforeEach(() => {
  consulta = '';
  push.mockClear();
});

const pagina = (data: unknown[], total = data.length, page = 1) =>
  respuestaJson({ total, page, limit: 10, data });

describe('ListaSolicitudes', () => {
  it('muestra cada solicitud con mascota, fundación, fecha y estado en texto', async () => {
    montarPanel(<ListaSolicitudes />, () =>
      pagina([
        resumen({ id: 1, estado: 'pendiente' }),
        resumen({ id: 2, estado: 'rechazada', mascota: { id: 8, nombre: 'Toby' } }),
      ]),
    );
    const lista = await screen.findByRole('list', { name: 'Solicitudes' });
    const filas = within(lista).getAllByRole('listitem');
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent('Luna');
    expect(filas[0]).toHaveTextContent('Patitas');
    expect(filas[0]).toHaveTextContent('Pendiente');
    expect(filas[0]).toHaveTextContent('20 de octubre de 2026');
    expect(filas[1]).toHaveTextContent('Rechazada');
    expect(
      screen.getByRole('link', { name: 'Ver detalle de la solicitud para Toby' }),
    ).toHaveAttribute('href', '/adoptante/solicitudes/2');
  });

  it('pide la página y el estado de la URL y los conserva en el enlace al detalle', async () => {
    consulta = 'pagina=2&estado=pendiente';
    const { llamadas } = montarPanel(<ListaSolicitudes />, () => pagina([resumen()], 11, 2));
    await screen.findByRole('list', { name: 'Solicitudes' });
    const [url] = llamadas('/mis-solicitudes')[0]!;
    expect(url).toContain('page=2');
    expect(url).toContain('estado=pendiente');
    expect(screen.getByRole('link', { name: /Ver detalle/ })).toHaveAttribute(
      'href',
      '/adoptante/solicitudes/1?pagina=2&estado=pendiente',
    );
    expect(screen.getByRole('combobox', { name: 'Filtrar por estado' })).toHaveTextContent(
      'Pendiente',
    );
  });

  it('cambiar el filtro vuelve a la página 1 en la URL', async () => {
    montarPanel(<ListaSolicitudes />, () => pagina([resumen()]));
    await screen.findByRole('list', { name: 'Solicitudes' });
    const combo = screen.getByRole('combobox', { name: 'Filtrar por estado' });
    combo.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.click(await screen.findByRole('option', { name: 'Cancelada' }));
    expect(push).toHaveBeenCalledWith('/adoptante/solicitudes?estado=cancelada');
  });

  it('pagina con los botones', async () => {
    montarPanel(<ListaSolicitudes />, () => pagina([resumen()], 25));
    await screen.findByRole('list', { name: 'Solicitudes' });
    expect(screen.getByText(/Página 1 de 3/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(push).toHaveBeenCalledWith('/adoptante/solicitudes?pagina=2');
  });

  it('sin solicitudes ofrece el siguiente paso', async () => {
    montarPanel(<ListaSolicitudes />, () => pagina([]));
    expect(await screen.findByText('Aún no has enviado solicitudes')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver mascotas en adopción' })).toHaveAttribute(
      'href',
      '/adoptar',
    );
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).toBeNull();
  });

  it('con un filtro sin resultados lo dice y permite ver todas', async () => {
    consulta = 'estado=aprobada';
    montarPanel(<ListaSolicitudes />, () => pagina([]));
    expect(await screen.findByText('No hay solicitudes con ese estado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver todas' }));
    expect(push).toHaveBeenCalledWith('/adoptante/solicitudes');
  });

  it('si la API no responde muestra el error con «Reintentar», sin tocar la sesión', async () => {
    let fallar = true;
    montarPanel(<ListaSolicitudes />, () => {
      if (fallar) return errorApi(500, 'Algo salió mal de nuestro lado. Inténtalo de nuevo.');
      return pagina([resumen()]);
    });
    const reintentar = await screen.findByRole('button', { name: 'Reintentar' });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fallar = false;
    await userEvent.click(reintentar);
    await waitFor(() =>
      expect(screen.getByRole('list', { name: 'Solicitudes' })).toBeInTheDocument(),
    );
    expect(reintentarSesion).not.toHaveBeenCalled();
  });
});
