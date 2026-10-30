import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorApi, montarPanel, respuestaJson } from '@/shared/testing/prueba-utils';
import { pagina, resumen } from '../prueba-datos';
import { PantallaFundaciones } from './PantallaFundaciones';

let consulta = '';
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(consulta),
  useRouter: () => ({ push }),
  usePathname: () => '/administrador/fundaciones',
}));
vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
const sesion = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }));
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => sesion.valor }));

beforeEach(() => {
  consulta = '';
  push.mockClear();
  sesion.valor = { estado: 'autenticado', usuario: { id: 9, rol: 'administrador' } };
});

describe('PantallaFundaciones', () => {
  it('lista las pendientes por defecto con nombre, NIT, ciudad, estado en texto y enlace Revisar', async () => {
    const { llamadas } = montarPanel(<PantallaFundaciones />, () =>
      respuestaJson(pagina([resumen(), resumen({ id: 2, nombre: 'Huellas', nit: '800' })])),
    );
    const tabla = await screen.findByRole('table');
    const filas = within(tabla).getAllByRole('row');
    expect(filas).toHaveLength(3);
    expect(filas[1]).toHaveTextContent('Patitas Felices');
    expect(filas[1]).toHaveTextContent('900123456-7');
    expect(filas[1]).toHaveTextContent('Montería');
    expect(filas[1]).toHaveTextContent('Pendiente');
    expect(
      within(filas[1]!).getByRole('link', { name: 'Revisar la fundación Patitas Felices' }),
    ).toHaveAttribute('href', '/administrador/fundaciones/1');
    expect(llamadas('/admin/fundaciones')[0]![0]).toContain('estado=pendiente');
  });

  it('el detalle conserva estado y página de la lista', async () => {
    consulta = 'estado=rechazada&pagina=2';
    montarPanel(<PantallaFundaciones />, () =>
      respuestaJson(pagina([resumen({ estadoValidacion: 'rechazada' })], { total: 15, page: 2 })),
    );
    expect(
      await screen.findByRole('link', { name: 'Revisar la fundación Patitas Felices' }),
    ).toHaveAttribute('href', '/administrador/fundaciones/1?estado=rechazada&pagina=2');
    expect(screen.getByText(/Página 2 de 2/)).toBeInTheDocument();
  });

  it('vacío distinto para pendientes y para otro estado', async () => {
    montarPanel(<PantallaFundaciones />, () => respuestaJson(pagina([])));
    expect(await screen.findByText('No hay fundaciones por validar')).toBeInTheDocument();
  });

  it('vacío de otro estado', async () => {
    consulta = 'estado=aprobada';
    montarPanel(<PantallaFundaciones />, () => respuestaJson(pagina([])));
    expect(await screen.findByText('No hay fundaciones en este estado')).toBeInTheDocument();
  });

  it('error con reintento sin cerrar la sesión', async () => {
    let falla = true;
    const { llamadas } = montarPanel(<PantallaFundaciones />, () =>
      falla ? errorApi(500, 'Falló') : respuestaJson(pagina([resumen()])),
    );
    await screen.findByRole('button', { name: 'Reintentar' });
    falla = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(llamadas('/admin/fundaciones').length).toBeGreaterThanOrEqual(2);
  });

  it('cambiar el filtro va a la URL y vuelve a la página 1', async () => {
    consulta = 'pagina=3';
    montarPanel(<PantallaFundaciones />, () => respuestaJson(pagina([resumen()], { total: 30 })));
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar por estado' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Aprobada' }));
    expect(push).toHaveBeenCalledWith('/administrador/fundaciones?estado=aprobada');
  });
});
