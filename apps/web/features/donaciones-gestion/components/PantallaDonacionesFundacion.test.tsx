import { QueryClientProvider } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  errorApi,
  montarPanel,
  respuestaJson,
  usuarioFundacion,
} from '@/shared/testing/prueba-utils';
import { donacion, pagina, totales } from '../prueba-datos';
import { PantallaDonacionesFundacion } from './PantallaDonacionesFundacion';

let consulta = '';
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(consulta),
  useRouter: () => ({ push }),
  usePathname: () => '/fundacion/donaciones',
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

describe('PantallaDonacionesFundacion', () => {
  it('lista fecha en Bogotá, donante, origen, tipo, monto y comprobante solo si existe; con el aviso sin pagos', async () => {
    montarPanel(<PantallaDonacionesFundacion />, () =>
      respuestaJson(
        pagina([
          donacion({ id: 1, comprobante: { url: '/api/fundacion/donaciones/1/comprobante' } }),
          donacion({
            id: 2,
            tipo: 'especie',
            monto: null,
            descripcionEspecie: '10 bultos de alimento',
            donante: { nombre: 'Ana Pérez', origen: 'plataforma' },
          }),
        ]),
      ),
    );
    const lista = await screen.findByRole('list', { name: 'Aportes recibidos' });
    const filas = within(lista).getAllByRole('listitem');
    expect(filas[0]).toHaveTextContent('María Gómez');
    expect(filas[0]).toHaveTextContent('3 de noviembre de 2026, 3:30');
    expect(filas[0]).toHaveTextContent('Registro manual');
    expect(filas[0]).toHaveTextContent('Económica: $ 50.000,50');
    expect(
      within(filas[0]!).getByRole('button', { name: 'Descargar comprobante' }),
    ).toBeInTheDocument();
    expect(filas[1]).toHaveTextContent('Desde PetHogar');
    expect(filas[1]).toHaveTextContent('En especie: 10 bultos de alimento');
    expect(within(filas[1]!).queryByRole('button', { name: 'Descargar comprobante' })).toBeNull();
    expect(screen.getByRole('note')).toHaveTextContent('PetHogar no procesa pagos');
    expect(screen.getByRole('link', { name: 'Registrar aporte' })).toHaveAttribute(
      'href',
      '/fundacion/donaciones/nueva',
    );
  });

  it('muestra los totales del backend (monto como cadena exacta) para el conjunto filtrado', async () => {
    montarPanel(<PantallaDonacionesFundacion />, () =>
      respuestaJson(
        pagina([donacion()], {
          totales: totales({ economica: { cantidad: 3, monto: '9007199254740993.10' } }),
        }),
      ),
    );
    const t = await screen.findByRole('region', { name: 'Totales del periodo' });
    // Con Number este valor perdería precisión (…992); con la cadena se conserva el 3 final.
    expect(t).toHaveTextContent('$ 9.007.199.254.740.993,10');
    expect(t).toHaveTextContent('3 aportes');
    expect(t).toHaveTextContent('1 aporte');
  });

  it('los totales cambian al cambiar el periodo (vienen de la misma respuesta que la lista)', async () => {
    consulta = 'desde=2026-10-01&hasta=2026-10-31';
    const { llamadas, rerender, queryClient } = montarPanel(
      <PantallaDonacionesFundacion />,
      (ruta) =>
        ruta.includes('desde=2026-10-01')
          ? respuestaJson(
              pagina([donacion()], {
                totales: totales({ economica: { cantidad: 1, monto: '1000.00' } }),
              }),
            )
          : respuestaJson(
              pagina([donacion()], {
                totales: totales({ economica: { cantidad: 9, monto: '777000.00' } }),
              }),
            ),
    );
    expect(await screen.findByText('$ 1.000')).toBeInTheDocument();
    expect(llamadas('/fundacion/donaciones')[0]![0]).toContain('desde=2026-10-01');
    expect(llamadas('/fundacion/donaciones')[0]![0]).toContain('hasta=2026-10-31');
    consulta = '';
    rerender(
      <QueryClientProvider client={queryClient}>
        <PantallaDonacionesFundacion />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('$ 777.000')).toBeInTheDocument();
  });

  it('un periodo invertido avisa junto al campo y no cambia la URL ni consulta', async () => {
    const { llamadas } = montarPanel(<PantallaDonacionesFundacion />, () =>
      respuestaJson(pagina([donacion()])),
    );
    await screen.findByRole('list', { name: 'Aportes recibidos' });
    const antes = llamadas('/fundacion/donaciones').length;
    await userEvent.type(screen.getByLabelText('Desde'), '2026-10-31');
    await userEvent.type(screen.getByLabelText('Hasta'), '2026-10-01');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    expect(
      await screen.findByText('La fecha final no puede ser anterior a la inicial'),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(llamadas('/fundacion/donaciones')).toHaveLength(antes);
  });

  it('aplicar periodo y tipo cambia la URL y vuelve a la página 1', async () => {
    consulta = 'pagina=3';
    montarPanel(<PantallaDonacionesFundacion />, () =>
      respuestaJson(pagina([donacion()], { total: 40, page: 3 })),
    );
    await screen.findByRole('list', { name: 'Aportes recibidos' });
    await userEvent.type(screen.getByLabelText('Desde'), '2026-10-01');
    await userEvent.type(screen.getByLabelText('Hasta'), '2026-10-31');
    await userEvent.click(screen.getByRole('combobox', { name: 'Tipo de aporte' }));
    await userEvent.click(await screen.findByRole('option', { name: 'En especie' }));
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    expect(push).toHaveBeenLastCalledWith(
      '/fundacion/donaciones?desde=2026-10-01&hasta=2026-10-31&tipo=especie',
    );
  });

  it('los atajos «Este mes», «Mes anterior» y «Todo» fijan el periodo de Bogotá', async () => {
    montarPanel(<PantallaDonacionesFundacion />, () => respuestaJson(pagina([donacion()])));
    await screen.findByRole('list', { name: 'Aportes recibidos' });
    await userEvent.click(screen.getByRole('button', { name: 'Este mes' }));
    expect(push.mock.lastCall![0]).toMatch(
      /^\/fundacion\/donaciones\?desde=\d{4}-\d{2}-01&hasta=\d{4}-\d{2}-\d{2}$/,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Todo' }));
    expect(push).toHaveBeenLastCalledWith('/fundacion/donaciones');
  });

  it('vacío sin filtros explica; con filtros ofrece quitarlos', async () => {
    montarPanel(<PantallaDonacionesFundacion />, () => respuestaJson(pagina([])));
    expect(await screen.findByText('Aún no hay aportes registrados')).toBeInTheDocument();
  });

  it('vacío con filtros: «Quitar filtros» limpia la URL', async () => {
    consulta = 'tipo=especie';
    montarPanel(<PantallaDonacionesFundacion />, () => respuestaJson(pagina([])));
    expect(await screen.findByText('No hay aportes en ese periodo')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    expect(push).toHaveBeenLastCalledWith('/fundacion/donaciones');
  });

  it('la paginación conserva los filtros', async () => {
    consulta = 'desde=2026-10-01&pagina=2';
    montarPanel(<PantallaDonacionesFundacion />, () =>
      respuestaJson(pagina([donacion()], { total: 25, page: 2 })),
    );
    await screen.findByRole('list', { name: 'Aportes recibidos' });
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(push).toHaveBeenLastCalledWith('/fundacion/donaciones?desde=2026-10-01');
  });

  it('error con «Reintentar» que no cierra la sesión', async () => {
    let falla = true;
    montarPanel(<PantallaDonacionesFundacion />, () =>
      falla ? errorApi(429, 'x') : respuestaJson(pagina([donacion()])),
    );
    await screen.findByText('No pudimos cargar esta información');
    falla = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByRole('list', { name: 'Aportes recibidos' });
    expect((sesion.valor.cerrarSesion as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it('al volver del registro muestra el aviso de filtros y enfoca el encabezado', async () => {
    consulta = 'registrado=1';
    montarPanel(<PantallaDonacionesFundacion />, () => respuestaJson(pagina([donacion()])));
    expect(await screen.findByRole('status')).toHaveTextContent('Aporte registrado');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Donaciones' })).toHaveFocus());
  });

  it('con la fundación pendiente muestra el motivo y no lanza peticiones', async () => {
    ponerSesion(usuarioFundacion('pendiente'));
    const { fetchImpl } = montarPanel(<PantallaDonacionesFundacion />, () => respuestaJson({}));
    expect(await screen.findByText('Tu fundación aún no está aprobada')).toBeInTheDocument();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
