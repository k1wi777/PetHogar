import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorApi, montarPanel, respuestaJson } from '@/shared/testing/prueba-utils';
import { pagina, usuario } from '../prueba-datos';
import { PantallaUsuarios } from './PantallaUsuarios';

let consulta = '';
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(consulta),
  useRouter: () => ({ push }),
  usePathname: () => '/administrador/usuarios',
}));
vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
const sesion = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }));
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => sesion.valor }));

beforeEach(() => {
  consulta = '';
  push.mockClear();
  sesion.valor = { estado: 'autenticado', usuario: { id: 1, rol: 'administrador' } };
});

const ADMIN = usuario({ id: 1, email: 'admin@pethogar.co', rol: 'administrador', nombre: null });
const ANA = usuario();
const BETO = usuario({ id: 3, email: 'beto@correo.co', nombre: 'Beto Ruiz', activo: false });

function api(patch?: (id: string, c: { activo: boolean }) => Response) {
  const estado = new Map<number, boolean>();
  return (ruta: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      const id = /\/admin\/usuarios\/(\d+)\/estado/.exec(ruta)![1]!;
      const cuerpo = JSON.parse(init.body as string) as { activo: boolean };
      if (patch) return patch(id, cuerpo);
      estado.set(Number(id), cuerpo.activo);
      return respuestaJson(usuario({ id: Number(id), activo: cuerpo.activo }));
    }
    return respuestaJson(
      pagina(
        [ADMIN, ANA, BETO].map((u) => (estado.has(u.id) ? { ...u, activo: estado.get(u.id)! } : u)),
      ),
    );
  };
}

describe('PantallaUsuarios', () => {
  it('lista nombre, correo, rol y estado en texto; «—» para el administrador sin nombre', async () => {
    montarPanel(<PantallaUsuarios />, api());
    const tabla = await screen.findByRole('table');
    const filas = within(tabla).getAllByRole('row');
    expect(filas).toHaveLength(4);
    expect(filas[1]).toHaveTextContent('—');
    expect(filas[1]).toHaveTextContent('admin@pethogar.co');
    expect(filas[1]).toHaveTextContent('Administrador');
    expect(filas[2]).toHaveTextContent('Ana Pérez');
    expect(filas[2]).toHaveTextContent('Activa');
    expect(filas[3]).toHaveTextContent('Desactivada');
  });

  it('la propia cuenta no ofrece activar ni desactivar y lo dice con texto', async () => {
    montarPanel(<PantallaUsuarios />, api());
    const filas = within(await screen.findByRole('table')).getAllByRole('row');
    expect(within(filas[1]!).queryByRole('button')).toBeNull();
    expect(filas[1]).toHaveTextContent('Es tu cuenta');
    expect(
      within(filas[2]!).getByRole('button', { name: /Desactivar la cuenta de Ana/ }),
    ).toBeVisible();
    expect(
      within(filas[3]!).getByRole('button', { name: /Activar la cuenta de Beto/ }),
    ).toBeVisible();
  });

  it('desactivar pide confirmación (advierte del cierre de sesiones) y refleja el cambio de inmediato', async () => {
    const { llamadas } = montarPanel(<PantallaUsuarios />, api());
    await userEvent.click(
      await screen.findByRole('button', { name: /Desactivar la cuenta de Ana/ }),
    );
    const dialogo = await screen.findByRole('dialog', {
      name: '¿Desactivar la cuenta de Ana Pérez?',
    });
    expect(dialogo).toHaveTextContent('se cerrará su sesión en todos los dispositivos');
    await userEvent.click(screen.getByRole('button', { name: 'Volver' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(llamadas('/admin/usuarios/2/estado', 'PATCH')).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: /Desactivar la cuenta de Ana/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, desactivar' }));
    expect(await screen.findByText('La cuenta de Ana Pérez quedó desactivada.')).toBeVisible();
    const patch = llamadas('/admin/usuarios/2/estado', 'PATCH');
    expect(JSON.parse(patch[0]![1]!.body as string)).toEqual({ activo: false });
    expect(await screen.findByRole('button', { name: /Activar la cuenta de Ana/ })).toBeVisible();
  });

  it('activar no advierte del cierre de sesiones', async () => {
    montarPanel(<PantallaUsuarios />, api());
    await userEvent.click(await screen.findByRole('button', { name: /Activar la cuenta de Beto/ }));
    const dialogo = await screen.findByRole('dialog', { name: '¿Activar la cuenta de Beto Ruiz?' });
    expect(dialogo).not.toHaveTextContent('se cerrará');
    await userEvent.click(screen.getByRole('button', { name: 'Sí, activar' }));
    expect(await screen.findByText('La cuenta de Beto Ruiz quedó activada.')).toBeVisible();
  });

  it('un 409 del servidor se muestra y la fila queda sin cambios', async () => {
    montarPanel(
      <PantallaUsuarios />,
      api(() => errorApi(409, 'Debe haber al menos un administrador activo')),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: /Desactivar la cuenta de Ana/ }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, desactivar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Debe haber al menos un administrador activo',
    );
    expect(screen.getByRole('button', { name: /Desactivar la cuenta de Ana/ })).toBeVisible();
  });

  it('filtros: la búsqueda va a la URL, se valida el máximo sin navegar y se pueden quitar', async () => {
    consulta = 'pagina=3';
    montarPanel(<PantallaUsuarios />, api());
    await screen.findByRole('table');
    await userEvent.type(screen.getByLabelText('Nombre'), 'a'.repeat(101));
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByText(/El nombre no puede superar los 100/)).toBeVisible();
    expect(push).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText('Nombre'));
    await userEvent.type(screen.getByLabelText('Nombre'), 'Ana');
    await userEvent.type(screen.getByLabelText('Correo'), 'correo.co');
    await userEvent.click(screen.getByRole('combobox', { name: 'Rol' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Adoptante' }));
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(push).toHaveBeenCalledWith(
      '/administrador/usuarios?nombre=Ana&correo=correo.co&rol=adoptante',
    );
  });

  it('vacío con filtros ofrece quitarlos; error con reintento', async () => {
    consulta = 'nombre=zzz';
    montarPanel(<PantallaUsuarios />, () => respuestaJson(pagina([])));
    expect(await screen.findByText('No encontramos usuarios con esa búsqueda')).toBeVisible();
  });

  it('error de carga muestra Reintentar sin cerrar la sesión', async () => {
    montarPanel(<PantallaUsuarios />, () => errorApi(500, 'Falló'));
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeVisible();
    expect((sesion.valor as { cerrarSesion?: unknown }).cerrarSesion).toBeUndefined();
  });
});
