import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  errorApi,
  montarPanel,
  respuestaJson,
  usuarioFundacion,
} from '@/shared/testing/prueba-utils';
import { adopcion, pagina, seguimiento } from '../prueba-datos';
import { PantallaAdopciones } from './PantallaAdopciones';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/fundacion/adopciones',
}));
vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
const sesion = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }));
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => sesion.valor }));

beforeEach(() => {
  sesion.valor = {
    estado: 'autenticado',
    usuario: usuarioFundacion('aprobada'),
    refrescarPerfil: vi.fn(),
    cerrarSesion: vi.fn(),
  };
});

const formulario = () => screen.getByRole('form', { name: /Cerrar la adopción de Luna/ });

/** Servidor simulado: PATCH de cierre configurable; la lista refleja el cierre una vez hecho. */
function servidor(opciones: { cierre?: () => Response; acta?: boolean } = {}) {
  let cerrada = false;
  const cuerpos: unknown[] = [];
  const base = () =>
    adopcion({
      acta: opciones.acta === false ? null : { url: '/api/fundacion/adopciones/1/acta' },
      seguimientos: [seguimiento({ id: 1 }), seguimiento({ id: 2, estado: 'programado' })],
    });
  const montado = montarPanel(<PantallaAdopciones />, (ruta, init) => {
    if (init?.method === 'PATCH' && ruta === '/adopciones/1/estado') {
      cuerpos.push(JSON.parse(init.body as string));
      if (opciones.cierre) return opciones.cierre();
      cerrada = true;
      return respuestaJson(
        cerradaDe(base(), cuerpos.at(-1) as { estado: 'finalizada' | 'revocada'; motivo: string }),
      );
    }
    const a = base();
    return respuestaJson(
      pagina([
        cerrada
          ? cerradaDe(a, cuerpos.at(-1) as { estado: 'finalizada' | 'revocada'; motivo: string })
          : a,
      ]),
    );
  });
  return { ...montado, cuerpos };
}

function cerradaDe(
  a: ReturnType<typeof adopcion>,
  c: { estado: 'finalizada' | 'revocada'; motivo: string },
) {
  return {
    ...a,
    estado: c.estado,
    motivoCierre: c.motivo,
    fechaCierre: '2026-12-05T10:00:00.000Z',
    seguimientos: a.seguimientos.map((s) => ({ ...s, estado: 'cancelado' as const })),
  };
}

async function abrirPanel() {
  const boton = await screen.findByRole('button', { name: 'Cerrar adopción' });
  await userEvent.click(boton);
  return boton;
}

describe('cierre de adopciones', () => {
  it('«Cerrar adopción» solo se ofrece con la adopción activa', async () => {
    montarPanel(<PantallaAdopciones />, () =>
      respuestaJson(
        pagina([
          adopcion({ id: 1 }),
          adopcion({ id: 2, estado: 'finalizada', mascota: { id: 8, nombre: 'Rocky' } }),
          adopcion({ id: 3, estado: 'revocada', mascota: { id: 9, nombre: 'Nina' } }),
        ]),
      ),
    );
    expect(await screen.findAllByRole('button', { name: 'Cerrar adopción' })).toHaveLength(1);
  });

  it('abre el panel con el foco en la primera opción y sin ningún estado elegido por defecto', async () => {
    servidor();
    const boton = await abrirPanel();
    expect(boton).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(screen.getByRole('radio', { name: /Finalizar/ })).toHaveFocus());
    expect(screen.getByRole('radio', { name: /Finalizar/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /Revocar/ })).not.toBeChecked();
    expect(screen.queryByRole('radio', { name: /disponible/ })).toBeNull();
  });

  it('solo hay un panel abierto por tarjeta: abrir «Cerrar» cierra «Programar»', async () => {
    servidor();
    await userEvent.click(await screen.findByRole('button', { name: /Programar seguimiento/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar adopción' }));
    expect(screen.queryByRole('form', { name: /Programar seguimiento de/ })).toBeNull();
    expect(formulario()).toBeInTheDocument();
  });

  it('exige estado y motivo y no llama a la API', async () => {
    const { llamadas } = servidor();
    await abrirPanel();
    await userEvent.click(within(formulario()).getByRole('button', { name: 'Continuar' }));
    expect(
      await within(formulario()).findByText(/Elige si quieres finalizar o revocar/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Finalizar/ }));
    await userEvent.type(screen.getByLabelText(/Motivo del cierre/), '   ');
    await userEvent.click(within(formulario()).getByRole('button', { name: 'Continuar' }));
    expect(await within(formulario()).findByText('Debes indicar el motivo')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(llamadas('/adopciones/1/estado', 'PATCH')).toHaveLength(0);
  });

  it('limita el motivo a 300 caracteres y muestra el contador', async () => {
    servidor();
    await abrirPanel();
    await userEvent.click(screen.getByRole('radio', { name: /Finalizar/ }));
    await userEvent.click(screen.getByLabelText(/Motivo del cierre/));
    await userEvent.paste('a'.repeat(301));
    expect(screen.getByText(/301 de 300 caracteres/)).toBeInTheDocument();
    await userEvent.click(within(formulario()).getByRole('button', { name: 'Continuar' }));
    expect(
      await within(formulario()).findByText('El motivo no puede superar 300 caracteres'),
    ).toBeInTheDocument();
  });

  it('el destino de la mascota solo se pide al revocar y es obligatorio', async () => {
    const { llamadas } = servidor();
    await abrirPanel();
    await userEvent.click(screen.getByRole('radio', { name: /Revocar/ }));
    expect(screen.getByRole('radio', { name: 'Vuelve a estar disponible' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Motivo del cierre/), 'Maltrato');
    await userEvent.click(within(formulario()).getByRole('button', { name: 'Continuar' }));
    expect(
      await within(formulario()).findByText(/Indica si la mascota vuelve a estar disponible/),
    ).toBeInTheDocument();
    expect(llamadas('/adopciones/1/estado', 'PATCH')).toHaveLength(0);
    // Al volver a finalizar el destino desaparece.
    await userEvent.click(screen.getByRole('radio', { name: /Finalizar/ }));
    expect(screen.queryByRole('radio', { name: /disponible/ })).toBeNull();
  });

  it('el diálogo de finalizar explica las consecuencias y avisa de que falta el acta', async () => {
    servidor({ acta: false });
    await abrirPanel();
    await userEvent.click(screen.getByRole('radio', { name: /Finalizar/ }));
    await userEvent.type(screen.getByLabelText(/Motivo del cierre/), 'Todo bien');
    await userEvent.click(within(formulario()).getByRole('button', { name: 'Continuar' }));
    const dialogo = await screen.findByRole('dialog', { name: '¿Finalizar la adopción de Luna?' });
    expect(dialogo).toHaveTextContent('Los seguimientos pendientes se cancelarán.');
    expect(dialogo).toHaveTextContent('Luna seguirá marcada como adoptada.');
    expect(dialogo).toHaveTextContent('Se avisará al adoptante del cierre.');
    expect(dialogo).toHaveTextContent('Esta decisión no se puede deshacer.');
    expect(dialogo).toHaveTextContent('Sube el acta antes de cerrar: después no podrás subirla.');
    expect(dialogo).toHaveTextContent('Motivo: Todo bien');
  });

  it.each([
    ['disponible', 'Vuelve a estar disponible', 'Luna volverá a estar disponible'],
    ['inactiva', 'Queda inactiva', 'Luna quedará inactiva'],
  ] as const)(
    'el diálogo de revocar con destino %s describe el estado de la mascota',
    async (destino, opcion, texto) => {
      servidor();
      await abrirPanel();
      await userEvent.click(screen.getByRole('radio', { name: /Revocar/ }));
      await userEvent.click(screen.getByRole('radio', { name: opcion }));
      await userEvent.type(screen.getByLabelText(/Motivo del cierre/), 'Maltrato');
      await userEvent.click(within(formulario()).getByRole('button', { name: 'Continuar' }));
      const dialogo = await screen.findByRole('dialog', { name: '¿Revocar la adopción de Luna?' });
      expect(dialogo).toHaveTextContent(texto);
      expect(dialogo).not.toHaveTextContent('Sube el acta antes de cerrar'); // ya tiene acta
      expect(destino).toBeTruthy();
    },
  );

  it('cancelar el diálogo no llama a la API y conserva lo escrito', async () => {
    const { llamadas } = servidor();
    await abrirPanel();
    await userEvent.click(screen.getByRole('radio', { name: /Finalizar/ }));
    await userEvent.type(screen.getByLabelText(/Motivo del cierre/), 'Todo bien');
    await userEvent.click(within(formulario()).getByRole('button', { name: 'Continuar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Volver' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(llamadas('/adopciones/1/estado', 'PATCH')).toHaveLength(0);
    expect(screen.getByLabelText(/Motivo del cierre/)).toHaveValue('Todo bien');
  });

  it('finalizar envía estado y motivo sin destino, refleja el cierre y deja los seguimientos cancelados sin registrar', async () => {
    const { cuerpos, llamadas } = servidor();
    await abrirPanel();
    await userEvent.click(screen.getByRole('radio', { name: /Finalizar/ }));
    await userEvent.type(screen.getByLabelText(/Motivo del cierre/), ' Todo bien ');
    await userEvent.click(within(formulario()).getByRole('button', { name: 'Continuar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, finalizar la adopción' }));
    await waitFor(() => expect(cuerpos).toEqual([{ estado: 'finalizada', motivo: 'Todo bien' }]));
    const tarjeta = await screen.findByRole('article', { name: /Luna/ });
    await waitFor(() => expect(tarjeta).toHaveTextContent('Todo bien'));
    expect(tarjeta).toHaveTextContent('Finalizada');
    expect(screen.getByText('Adopción de Luna finalizada.')).toBeInTheDocument();
    expect(within(tarjeta).queryByRole('button', { name: 'Cerrar adopción' })).toBeNull();
    expect(within(tarjeta).queryByRole('button', { name: /Programar seguimiento/ })).toBeNull();
    expect(
      within(tarjeta).queryByRole('button', { name: /Subir acta|Reemplazar acta/ }),
    ).toBeNull();
    const filas = within(screen.getByRole('list', { name: 'Seguimientos de Luna' })).getAllByRole(
      'listitem',
    );
    for (const fila of filas) {
      expect(fila).toHaveTextContent('Cancelado');
      expect(within(fila).getByRole('link')).toHaveTextContent('Ver detalle');
      expect(within(fila).queryByText(/Registrar resultado|Revisar reporte/)).toBeNull();
    }
    // Invalidó adopciones, mascotas y solicitudes: la lista se vuelve a leer del servidor.
    await waitFor(() => expect(llamadas('/fundacion/adopciones', 'GET').length).toBeGreaterThan(1));
    await waitFor(() => expect(document.getElementById('adopcion-1')).toHaveFocus());
  });

  it('revocar envía el destino elegido', async () => {
    const { cuerpos } = servidor();
    await abrirPanel();
    await userEvent.click(screen.getByRole('radio', { name: /Revocar/ }));
    await userEvent.click(screen.getByRole('radio', { name: 'Queda inactiva' }));
    await userEvent.type(screen.getByLabelText(/Motivo del cierre/), 'Maltrato');
    await userEvent.click(within(formulario()).getByRole('button', { name: 'Continuar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, revocar la adopción' }));
    await waitFor(() =>
      expect(cuerpos).toEqual([
        { estado: 'revocada', motivo: 'Maltrato', mascotaDestino: 'inactiva' },
      ]),
    );
    expect(await screen.findByText('Adopción de Luna revocada.')).toBeInTheDocument();
  });

  async function intentarFinalizar() {
    await abrirPanel();
    await userEvent.click(screen.getByRole('radio', { name: /Finalizar/ }));
    await userEvent.type(screen.getByLabelText(/Motivo del cierre/), 'Todo bien');
    await userEvent.click(within(formulario()).getByRole('button', { name: 'Continuar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, finalizar la adopción' }));
  }

  it('409 (ya cerrada): lo explica, refresca el estado real y no cierra la sesión', async () => {
    const { llamadas } = servidor({
      cierre: () => errorApi(409, 'La adopción ya está finalizada'),
    });
    await intentarFinalizar();
    expect(await screen.findByText(/Esta adopción ya fue cerrada/)).toBeInTheDocument();
    await waitFor(() => expect(llamadas('/fundacion/adopciones', 'GET').length).toBeGreaterThan(1));
    expect(sesion.valor.cerrarSesion).not.toHaveBeenCalled();
  });

  it('404: avisa de que la adopción ya no existe', async () => {
    servidor({ cierre: () => errorApi(404, 'La adopción no existe') });
    await intentarFinalizar();
    expect(await screen.findByText('La adopción ya no existe.')).toBeInTheDocument();
  });

  it('un 400 del servidor se muestra junto a su campo', async () => {
    servidor({
      cierre: () =>
        errorApi(400, 'Datos inválidos', [
          { campo: 'motivo', mensajes: ['Debes indicar el motivo'] },
        ]),
    });
    await intentarFinalizar();
    expect(await within(formulario()).findByText('Debes indicar el motivo')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('un fallo de red deja el formulario para reintentar y no cierra la sesión', async () => {
    let falla = true;
    const { cuerpos } = servidor({
      cierre: () => {
        if (falla) throw new TypeError('Failed to fetch');
        return respuestaJson(adopcion({ estado: 'finalizada' }));
      },
    });
    await intentarFinalizar();
    expect(await within(formulario()).findByRole('alert')).toHaveTextContent(/No pudimos conectar/);
    expect(sesion.valor.cerrarSesion).not.toHaveBeenCalled();
    falla = false;
    await userEvent.click(within(formulario()).getByRole('button', { name: 'Continuar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, finalizar la adopción' }));
    await waitFor(() => expect(cuerpos).toHaveLength(2));
  });
});
