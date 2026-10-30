import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  errorApi,
  montarPanel,
  respuestaJson,
  type Manejador,
} from '@/shared/testing/prueba-utils';
import { ESPECIES, RAZAS, detalle, evento, fundacion, mascota } from '../prueba-datos';
import type { MascotaGestionDetalle } from '../types';
import { FichaGestion } from './FichaGestion';

let consulta = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(consulta),
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/fundacion/mascotas/5',
}));
vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
const sesion = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }));
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => sesion.valor }));

let actual: MascotaGestionDetalle;
beforeEach(() => {
  consulta = '';
  replace.mockClear();
  actual = detalle();
  sesion.valor = {
    estado: 'autenticado',
    usuario: fundacion('aprobada'),
    refrescarPerfil: vi.fn(),
    cerrarSesion: vi.fn(),
  };
});

function api(extra: Manejador = () => errorApi(404, 'no')): Manejador {
  return (ruta, init) => {
    if (ruta === '/fundacion/mascotas/5') return respuestaJson(actual);
    if (ruta === '/especies') return respuestaJson(ESPECIES);
    const razas = /^\/especies\/(\d+)\/razas$/.exec(ruta);
    if (razas) return respuestaJson(RAZAS[Number(razas[1])] ?? []);
    if (ruta === '/mascotas/5/historial' && !init?.method) return respuestaJson([evento(1)]);
    return extra(ruta, init);
  };
}

const bajaExitosa: Manejador = (ruta, init) => {
  if (ruta === '/mascotas/5/baja' && init?.method === 'PATCH') {
    actual = { ...actual, estado: 'inactiva' };
    return respuestaJson(mascota({ estado: 'inactiva' }));
  }
  return errorApi(404, 'no');
};

describe('FichaGestion', () => {
  it('muestra el nombre, el estado en texto y la pestaña «Datos» con el formulario', async () => {
    consulta = 'pagina=2&estado=disponible';
    montarPanel(<FichaGestion idTexto="5" />, api());
    expect(await screen.findByRole('heading', { level: 1, name: 'Firulais' })).toBeInTheDocument();
    expect(screen.getByText('Disponible')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Datos' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Volver a Mis mascotas/ })).toHaveAttribute(
      'href',
      '/fundacion/mascotas?pagina=2&estado=disponible',
    );
  });

  it('la pestaña activa viene de la URL y al cambiar se escribe en ella', async () => {
    consulta = 'pestana=fotos&pagina=2';
    montarPanel(<FichaGestion idTexto="5" />, api());
    expect(await screen.findByRole('heading', { name: 'Fotos' })).toBeInTheDocument();
    expect(
      screen.getByText('2 de 6 fotos. La primera que subas queda como principal.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Historial médico' }));
    expect(replace).toHaveBeenCalledWith('/fundacion/mascotas/5?pestana=historial&pagina=2', {
      scroll: false,
    });
  });

  it('tras publicar avisa que el catálogo puede tardar hasta un minuto', async () => {
    consulta = 'pestana=fotos&publicada=1';
    montarPanel(<FichaGestion idTexto="5" />, api());
    expect(await screen.findByText(/Publicaste a Firulais/)).toHaveTextContent('hasta un minuto');
  });

  describe('Dar de baja', () => {
    it('Cancelar en el diálogo no hace ninguna petición', async () => {
      const { llamadas } = montarPanel(<FichaGestion idTexto="5" />, api(bajaExitosa));
      await userEvent.click(await screen.findByRole('button', { name: 'Dar de baja' }));
      const dialogo = await screen.findByRole('dialog', { name: '¿Dar de baja a Firulais?' });
      expect(dialogo).toHaveTextContent('no podrás reactivarla');
      await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(llamadas('/mascotas/5/baja')).toHaveLength(0);
      expect(screen.getByText('Disponible')).toBeInTheDocument();
    });

    it('Confirmar pasa la mascota a inactiva, avisa y retira la acción', async () => {
      const { llamadas } = montarPanel(<FichaGestion idTexto="5" />, api(bajaExitosa));
      await userEvent.click(await screen.findByRole('button', { name: 'Dar de baja' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Sí, dar de baja' }));
      expect(
        await screen.findByText(/fue dada de baja y ya no aparece en el catálogo/),
      ).toBeInTheDocument();
      expect(llamadas('/mascotas/5/baja', 'PATCH')).toHaveLength(1);
      expect(screen.getByText('Inactiva')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Dar de baja' })).toBeNull();
      await waitFor(() =>
        expect(screen.getByRole('heading', { level: 1, name: 'Firulais' })).toHaveFocus(),
      );
      expect(screen.getAllByText(/no puede reactivarse/).length).toBeGreaterThan(0);
      // La mascota inactiva ya no se edita.
      expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull();
    });

    it('un 409 informa en español y refresca la ficha con el estado real', async () => {
      const { llamadas } = montarPanel(
        <FichaGestion idTexto="5" />,
        api((ruta, init) => {
          if (ruta === '/mascotas/5/baja' && init?.method === 'PATCH') {
            actual = { ...actual, estado: 'en_proceso' };
            return errorApi(409, 'La mascota no puede pasar de en_proceso a inactiva');
          }
          return errorApi(404, 'no');
        }),
      );
      await userEvent.click(await screen.findByRole('button', { name: 'Dar de baja' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Sí, dar de baja' }));
      const alerta = await screen.findByRole('alert');
      expect(alerta).toHaveTextContent('La mascota no puede pasar de en_proceso a inactiva');
      expect(alerta).toHaveTextContent('Actualizamos la ficha con el estado real');
      await waitFor(() => expect(screen.getByText('En proceso')).toBeInTheDocument());
      expect(llamadas('/fundacion/mascotas/5').length).toBeGreaterThanOrEqual(2);
      expect(screen.queryByRole('button', { name: 'Dar de baja' })).toBeNull();
    });

    it('un 403 muestra el estado de fundación no aprobada sin cerrar la sesión', async () => {
      montarPanel(
        <FichaGestion idTexto="5" />,
        api((ruta, init) =>
          ruta === '/mascotas/5/baja' && init?.method === 'PATCH'
            ? errorApi(403, 'Tu fundación fue rechazada; revisa la observación del administrador')
            : errorApi(404, 'no'),
        ),
      );
      await userEvent.click(await screen.findByRole('button', { name: 'Dar de baja' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Sí, dar de baja' }));
      expect(await screen.findByText('Tu fundación aún no está aprobada')).toBeInTheDocument();
      expect(sesion.valor.cerrarSesion).not.toHaveBeenCalled();
    });
  });

  describe('acciones según el estado', () => {
    it('en proceso: se edita, pero no hay baja y se explica por qué', async () => {
      actual = detalle({ estado: 'en_proceso' });
      montarPanel(<FichaGestion idTexto="5" />, api());
      expect(await screen.findByText(/Tiene una solicitud en curso/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Dar de baja' })).toBeNull();
      expect(await screen.findByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();
    });

    it.each([
      ['adoptada', /Ya fue adoptada; sus datos no se pueden modificar/],
      ['inactiva', /Fue dada de baja y no puede reactivarse/],
    ] as const)('%s: datos en solo lectura con la razón y sin acciones', async (estado, razon) => {
      actual = detalle({ estado });
      montarPanel(<FichaGestion idTexto="5" />, api());
      expect(await screen.findByText(razon)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Dar de baja' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull();
      expect(screen.queryByLabelText(/^Nombre/)).toBeNull();
      expect(screen.getByText('Firulais', { selector: 'dd' })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByText('Criollo')).toBeInTheDocument());
    });
  });

  it('una mascota inexistente (404) o un id inválido muestran «No encontramos esta mascota»', async () => {
    const a = montarPanel(<FichaGestion idTexto="5" />, () =>
      errorApi(404, 'La mascota no existe'),
    );
    expect(await screen.findByText('No encontramos esta mascota')).toBeInTheDocument();
    a.unmount();
    const b = montarPanel(<FichaGestion idTexto="abc" />, () => respuestaJson({}));
    expect(await screen.findByText('No encontramos esta mascota')).toBeInTheDocument();
    expect(b.llamadas('/fundacion/mascotas')).toHaveLength(0);
  });

  it('si la API falla ofrece «Reintentar» sin cerrar la sesión', async () => {
    let falla = true;
    montarPanel(<FichaGestion idTexto="5" />, (ruta, init) =>
      falla && ruta === '/fundacion/mascotas/5' ? errorApi(500, 'x') : api()(ruta, init),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar');
    falla = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Firulais' })).toBeInTheDocument();
    expect(sesion.valor.cerrarSesion).not.toHaveBeenCalled();
  });

  it('con la fundación pendiente no hace peticiones y muestra el motivo', async () => {
    sesion.valor = { ...sesion.valor, usuario: fundacion('pendiente') };
    const { fetchImpl } = montarPanel(<FichaGestion idTexto="5" />, api());
    expect(await screen.findByText('Tu fundación aún no está aprobada')).toBeInTheDocument();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
