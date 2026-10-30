import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  errorApi,
  montarPanel,
  respuestaJson,
  usuarioFundacion,
} from '@/shared/testing/prueba-utils';
import { adopcion, detalleSeguimiento, pagina, seguimiento } from '../prueba-datos';
import { PantallaAdopciones } from './PantallaAdopciones';

let consulta = '';
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(consulta),
  useRouter: () => ({ push }),
  usePathname: () => '/fundacion/adopciones',
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

const FUTURO = '2099-01-15';

describe('PantallaAdopciones', () => {
  it('lista adopciones con adoptante, entrega, estado y su línea de tiempo', async () => {
    montarPanel(<PantallaAdopciones />, () =>
      respuestaJson(
        pagina([
          adopcion({
            seguimientos: [
              seguimiento({ id: 2, tipo: 'reporte', fechaProgramada: '2026-12-20' }),
              seguimiento({
                id: 1,
                fechaProgramada: '2026-12-01',
                estado: 'realizado',
                fechaRealizada: '2026-12-02',
              }),
            ],
          }),
        ]),
      ),
    );
    const tarjeta = await screen.findByRole('article', { name: /Luna/ });
    expect(tarjeta).toHaveTextContent('Ana Pérez');
    expect(tarjeta).toHaveTextContent('ana@correo.co');
    expect(tarjeta).toHaveTextContent('20 de noviembre de 2026');
    expect(within(tarjeta).getAllByText('Activa').length).toBeGreaterThan(0);
    const filas = within(screen.getByRole('list', { name: 'Seguimientos de Luna' })).getAllByRole(
      'listitem',
    );
    expect(filas).toHaveLength(2);
    // Orden cronológico por fecha límite.
    expect(filas[0]).toHaveTextContent('Visita');
    expect(filas[0]).toHaveTextContent('Realizado');
    expect(filas[0]).toHaveTextContent('Realizado el 2 de diciembre de 2026');
    expect(filas[1]).toHaveTextContent('Reporte del adoptante');
    expect(within(filas[1]!).getByRole('link')).toHaveAttribute(
      'href',
      '/fundacion/adopciones/seguimientos/2',
    );
  });

  it('el vencido se señala con texto, icono y borde, no solo con color', async () => {
    montarPanel(<PantallaAdopciones />, () =>
      respuestaJson(
        pagina([
          adopcion({
            seguimientos: [seguimiento({ vencido: true, fechaProgramada: '2026-12-01' })],
          }),
        ]),
      ),
    );
    const fila = (await screen.findAllByRole('listitem')).find((li) => li.id === 'seguimiento-1')!;
    expect(fila).toHaveTextContent('Vencido');
    expect(fila).toHaveTextContent('Venció el 1 de diciembre de 2026');
    expect(fila.className).toContain('border-l-8');
    expect(fila.querySelector('svg')).not.toBeNull();
  });

  it('avisa cuando la API devolvió los 20 seguimientos más recientes', async () => {
    const veinte = Array.from({ length: 20 }, (_, i) => seguimiento({ id: i + 1 }));
    montarPanel(<PantallaAdopciones />, () =>
      respuestaJson(pagina([adopcion({ seguimientos: veinte })])),
    );
    expect(
      await screen.findByText('Mostramos los 20 seguimientos más recientes.'),
    ).toBeInTheDocument();
  });

  it('una adopción cerrada muestra el cierre en solo lectura y no ofrece programar', async () => {
    montarPanel(<PantallaAdopciones />, () =>
      respuestaJson(
        pagina([
          adopcion({
            estado: 'revocada',
            motivoCierre: 'No cuidaba a la mascota',
            fechaCierre: '2026-12-05T10:00:00.000Z',
          }),
        ]),
      ),
    );
    const tarjeta = await screen.findByRole('article', { name: /Luna/ });
    expect(tarjeta).toHaveTextContent('No cuidaba a la mascota');
    expect(tarjeta).toHaveTextContent('Revocada');
    expect(within(tarjeta).queryByRole('button', { name: /Programar seguimiento/ })).toBeNull();
  });

  it('programar valida en el cliente: la fecha igual a la entrega no llama a la API', async () => {
    const { llamadas } = montarPanel(<PantallaAdopciones />, () =>
      respuestaJson(pagina([adopcion()])),
    );
    await userEvent.click(await screen.findByRole('button', { name: /Programar seguimiento/ }));
    await userEvent.click(screen.getByRole('radio', { name: /Visita/ }));
    await userEvent.type(screen.getByLabelText(/Fecha límite del seguimiento/), '2026-11-20');
    await userEvent.click(
      within(screen.getByRole('form')).getByRole('button', { name: 'Programar seguimiento' }),
    );
    expect(
      await screen.findByText(
        'La fecha del seguimiento debe ser posterior a la fecha de entrega (2026-11-20)',
      ),
    ).toBeInTheDocument();
    expect(llamadas('/adopciones/1/seguimientos', 'POST')).toHaveLength(0);
  });

  it('programar exige tipo y fecha', async () => {
    const { llamadas } = montarPanel(<PantallaAdopciones />, () =>
      respuestaJson(pagina([adopcion()])),
    );
    await userEvent.click(await screen.findByRole('button', { name: /Programar seguimiento/ }));
    await userEvent.click(
      within(screen.getByRole('form')).getByRole('button', { name: 'Programar seguimiento' }),
    );
    expect(await screen.findByText('El tipo debe ser visita o reporte')).toBeInTheDocument();
    expect(screen.getByText('Debes indicar la fecha del seguimiento')).toBeInTheDocument();
    expect(llamadas('/adopciones/1/seguimientos', 'POST')).toHaveLength(0);
  });

  it('programar con éxito envía tipo y fecha, actualiza la línea de tiempo y enfoca la nueva fila', async () => {
    let creado = false;
    const cuerpos: unknown[] = [];
    montarPanel(<PantallaAdopciones />, (ruta, init) => {
      if (init?.method === 'POST') {
        creado = true;
        cuerpos.push(JSON.parse(init.body as string));
        return respuestaJson(detalleSeguimiento({ id: 9, fechaProgramada: FUTURO }), 201);
      }
      return respuestaJson(
        pagina([
          adopcion({
            seguimientos: creado
              ? [seguimiento({ id: 1 }), seguimiento({ id: 9, fechaProgramada: FUTURO })]
              : [seguimiento({ id: 1 })],
          }),
        ]),
      );
    });
    const abrir = await screen.findByRole('button', { name: /Programar seguimiento/ });
    expect(abrir).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(abrir);
    expect(abrir).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(screen.getByRole('radio', { name: /Visita/ })).toHaveFocus());
    await userEvent.click(screen.getByRole('radio', { name: /Visita/ }));
    await userEvent.type(screen.getByLabelText(/Fecha límite del seguimiento/), FUTURO);
    await userEvent.click(
      within(screen.getByRole('form')).getByRole('button', { name: 'Programar seguimiento' }),
    );
    await waitFor(() => expect(document.getElementById('seguimiento-9')).not.toBeNull());
    expect(cuerpos).toEqual([{ tipo: 'visita', fechaProgramada: FUTURO }]);
    await waitFor(() => expect(document.getElementById('seguimiento-9')).toHaveFocus());
    expect(screen.getByRole('status')).toHaveTextContent('Seguimiento programado para Luna.');
    expect(screen.queryByRole('form')).toBeNull();
    expect(
      within(screen.getByRole('list', { name: 'Seguimientos de Luna' })).getAllByRole('listitem'),
    ).toHaveLength(2);
  });

  it('un 409 por duplicado se muestra en el panel y no lo cierra', async () => {
    montarPanel(<PantallaAdopciones />, (ruta, init) =>
      init?.method === 'POST'
        ? errorApi(409, 'Ya hay un seguimiento de ese tipo programado para esa fecha')
        : respuestaJson(pagina([adopcion()])),
    );
    await userEvent.click(await screen.findByRole('button', { name: /Programar seguimiento/ }));
    await userEvent.click(screen.getByRole('radio', { name: /Reporte/ }));
    await userEvent.type(screen.getByLabelText(/Fecha límite del seguimiento/), FUTURO);
    await userEvent.click(
      within(screen.getByRole('form')).getByRole('button', { name: 'Programar seguimiento' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya hay un seguimiento de ese tipo');
    expect(screen.getByRole('form')).toBeInTheDocument();
  });

  it('Cancelar cierra el panel y devuelve el foco al botón; solo un panel abierto a la vez', async () => {
    montarPanel(<PantallaAdopciones />, () =>
      respuestaJson(
        pagina([adopcion({ id: 1 }), adopcion({ id: 2, mascota: { id: 8, nombre: 'Rocky' } })]),
      ),
    );
    const botones = await screen.findAllByRole('button', { name: /Programar seguimiento/ });
    await userEvent.click(botones[0]!);
    await userEvent.click(botones[1]!);
    expect(screen.getAllByRole('form')).toHaveLength(1);
    expect(botones[0]).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('form')).toBeNull();
    await waitFor(() => expect(botones[1]).toHaveFocus());
  });

  it('el filtro de estado y la paginación viajan por la URL', async () => {
    consulta = 'estado=activa&pagina=2';
    const { llamadas } = montarPanel(<PantallaAdopciones />, () =>
      respuestaJson(pagina([adopcion()], { total: 25, page: 2 })),
    );
    await screen.findByRole('article', { name: /Luna/ });
    expect(llamadas('/fundacion/adopciones')[0]![0]).toContain('estado=activa');
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(push).toHaveBeenLastCalledWith('/fundacion/adopciones?estado=activa');
  });

  it('sin adopciones ni filtros explica cuándo aparecerán', async () => {
    montarPanel(<PantallaAdopciones />, () => respuestaJson(pagina([])));
    expect(await screen.findByText('Aún no tienes adopciones')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver todas' })).toBeNull();
  });

  it('con filtro vacío ofrece ver todas; con error reintenta sin cerrar sesión', async () => {
    consulta = 'estado=finalizada';
    let falla = true;
    montarPanel(<PantallaAdopciones />, () =>
      falla ? errorApi(503, 'x') : respuestaJson(pagina([])),
    );
    await screen.findByText('No pudimos cargar esta información');
    falla = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText('No hay adopciones con ese estado');
    await userEvent.click(screen.getByRole('button', { name: 'Ver todas' }));
    expect(push).toHaveBeenLastCalledWith('/fundacion/adopciones');
    expect((sesion.valor.cerrarSesion as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it('con la fundación rechazada muestra el motivo y no lanza peticiones', async () => {
    ponerSesion(usuarioFundacion('rechazada', 'Falta el RUT'));
    const { fetchImpl } = montarPanel(<PantallaAdopciones />, () => respuestaJson({}));
    expect(
      await screen.findByText(/Observación del administrador: Falta el RUT/),
    ).toBeInTheDocument();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
