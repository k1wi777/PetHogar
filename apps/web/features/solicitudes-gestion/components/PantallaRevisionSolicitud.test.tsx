import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  errorApi,
  montarPanel,
  respuestaJson,
  usuarioFundacion,
} from '@/shared/testing/prueba-utils';
import { detalle, pagina } from '../prueba-datos';
import { PantallaRevisionSolicitud } from './PantallaRevisionSolicitud';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('estado=pendiente'),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/fundacion/solicitudes/1',
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

const APROBADA = detalle({
  estado: 'aprobada',
  fechaRespuesta: '2026-11-05',
  observacion: 'Bienvenida',
  adopcion: { id: 3, fechaEntrega: '2099-01-01', estado: 'activa' },
});

/** GET devuelve `lectura`; PATCH devuelve `respuesta` (por defecto la aprobada). */
function api(opciones: { lectura?: () => Response; patch?: (c: unknown) => Response } = {}) {
  return (ruta: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      const cuerpo = JSON.parse(init.body as string) as unknown;
      return (opciones.patch ?? (() => respuestaJson(APROBADA)))(cuerpo);
    }
    if (ruta.startsWith('/fundacion/solicitudes?'))
      return respuestaJson(pagina([{}, {}, {}], { total: 3 }));
    return (opciones.lectura ?? (() => respuestaJson(detalle())))();
  };
}

async function elegir(texto: string) {
  await userEvent.click(await screen.findByRole('radio', { name: texto }));
}

describe('PantallaRevisionSolicitud', () => {
  it('muestra los datos del adoptante, la solicitud y la descarga del formulario', async () => {
    montarPanel(<PantallaRevisionSolicitud idTexto="1" />, api());
    expect(await screen.findByRole('heading', { name: 'Solicitud para Luna' })).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ana@correo.co' })).toHaveAttribute(
      'href',
      'mailto:ana@correo.co',
    );
    expect(screen.getByRole('link', { name: '3001234567' })).toHaveAttribute(
      'href',
      'tel:3001234567',
    );
    expect(screen.getByText('Montería')).toBeInTheDocument();
    expect(screen.getByText(/Tengo patio y tiempo/)).toBeInTheDocument();
    expect(screen.getByText('Casa')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Descargar formulario firmado' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Volver a solicitudes recibidas/ })).toHaveAttribute(
      'href',
      '/fundacion/solicitudes?estado=pendiente',
    );
  });

  it('aprobar exige la fecha de entrega y no llama a la API sin ella', async () => {
    const { llamadas } = montarPanel(<PantallaRevisionSolicitud idTexto="1" />, api());
    await elegir('Aprobar la solicitud');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Debes indicar la fecha de entrega')).toBeInTheDocument();
    expect(llamadas('/solicitudes/1/decision')).toHaveLength(0);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('una fecha de entrega pasada se rechaza en el cliente', async () => {
    const { llamadas } = montarPanel(<PantallaRevisionSolicitud idTexto="1" />, api());
    await elegir('Aprobar la solicitud');
    await userEvent.type(screen.getByLabelText(/Fecha de entrega/), '2020-01-01');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(
      await screen.findByText('La fecha de entrega no puede ser anterior a hoy'),
    ).toBeInTheDocument();
    expect(llamadas('/solicitudes/1/decision')).toHaveLength(0);
  });

  it('rechazar exige el motivo y no pide fecha de entrega', async () => {
    const { llamadas } = montarPanel(<PantallaRevisionSolicitud idTexto="1" />, api());
    await elegir('Rechazar la solicitud');
    expect(screen.queryByLabelText(/Fecha de entrega/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Debes indicar el motivo del rechazo')).toBeInTheDocument();
    expect(llamadas('/solicitudes/1/decision')).toHaveLength(0);
  });

  it('el diálogo de aprobar advierte de la cascada y muestra cuántas más hay', async () => {
    montarPanel(<PantallaRevisionSolicitud idTexto="1" />, api());
    await elegir('Aprobar la solicitud');
    await userEvent.type(screen.getByLabelText(/Fecha de entrega/), '2099-01-01');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    const dialogo = await screen.findByRole('dialog', { name: '¿Aprobar la solicitud de Luna?' });
    expect(dialogo).toHaveTextContent(
      'Al aprobar, las demás solicitudes pendientes de Luna se rechazarán automáticamente y no se puede deshacer.',
    );
    expect(dialogo).toHaveTextContent('Entrega el 1 de enero de 2099');
    await waitFor(() =>
      expect(dialogo).toHaveTextContent('Hay 2 solicitudes más pendientes de Luna'),
    );
  });

  it('la advertencia aparece aunque la consulta de otras pendientes falle', async () => {
    montarPanel(<PantallaRevisionSolicitud idTexto="1" />, (ruta, init) =>
      ruta.startsWith('/fundacion/solicitudes?') ? errorApi(500, 'x') : api()(ruta, init),
    );
    await elegir('Aprobar la solicitud');
    await userEvent.type(screen.getByLabelText(/Fecha de entrega/), '2099-01-01');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent(/se rechazarán automáticamente/);
  });

  it('el diálogo de rechazar no advierte de cascada; Cancelar y Escape no envían', async () => {
    const { llamadas } = montarPanel(<PantallaRevisionSolicitud idTexto="1" />, api());
    await elegir('Rechazar la solicitud');
    await userEvent.type(screen.getByLabelText(/Motivo del rechazo/), 'No cumple');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    const dialogo = await screen.findByRole('dialog', { name: '¿Rechazar la solicitud?' });
    expect(dialogo).toHaveTextContent('El adoptante recibirá este motivo: No cumple');
    expect(dialogo).not.toHaveTextContent('automáticamente');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Volver' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(llamadas('/solicitudes/1/decision')).toHaveLength(0);
  });

  it('aprobar envía fecha, muestra el resultado con enlace a adopciones, enfoca el encabezado e invalida mascotas y adopciones', async () => {
    const cuerpos: unknown[] = [];
    const { queryClient } = montarPanel(
      <PantallaRevisionSolicitud idTexto="1" />,
      api({
        lectura: () => respuestaJson(cuerpos.length ? APROBADA : detalle()),
        patch: (c) => (cuerpos.push(c), respuestaJson(APROBADA)),
      }),
    );
    const invalidar = vi.spyOn(queryClient, 'invalidateQueries');
    await elegir('Aprobar la solicitud');
    await userEvent.type(screen.getByLabelText(/Fecha de entrega/), '2099-01-01');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Sí, aprobar y crear la adopción' }),
    );
    const titulo = await screen.findByRole('heading', { name: 'Solicitud aprobada' });
    expect(cuerpos).toEqual([{ decision: 'aprobar', fechaEntrega: '2099-01-01' }]);
    await waitFor(() => expect(titulo).toHaveFocus());
    expect(
      screen.getByText(/Adopción creada: la entrega de Luna es el 1 de enero de 2099/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a adopciones' })).toHaveAttribute(
      'href',
      '/fundacion/adopciones',
    );
    expect(screen.queryByRole('button', { name: 'Continuar' })).toBeNull();
    const claves = invalidar.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(claves).toContain('["adopciones-gestion"]');
    expect(claves).toContain('["mascotas-gestion"]');
    expect(claves).toContain('["solicitudes-gestion"]');
  });

  it('rechazar envía solo la observación y confirma', async () => {
    const cuerpos: unknown[] = [];
    montarPanel(
      <PantallaRevisionSolicitud idTexto="1" />,
      api({
        patch: (c) => (
          cuerpos.push(c),
          respuestaJson(detalle({ estado: 'rechazada', observacion: 'No cumple', adopcion: null }))
        ),
      }),
    );
    await elegir('Rechazar la solicitud');
    await userEvent.type(screen.getByLabelText(/Motivo del rechazo/), 'No cumple');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, rechazar' }));
    expect(await screen.findByRole('heading', { name: 'Solicitud rechazada' })).toBeInTheDocument();
    expect(cuerpos).toEqual([{ decision: 'rechazar', observacion: 'No cumple' }]);
  });

  it('un doble clic en confirmar envía una sola petición', async () => {
    const { llamadas } = montarPanel(
      <PantallaRevisionSolicitud idTexto="1" />,
      api({
        patch: () => APROBADA && respuestaJson(APROBADA),
      }),
    );
    await elegir('Rechazar la solicitud');
    await userEvent.type(screen.getByLabelText(/Motivo del rechazo/), 'No cumple');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    const confirmar = await screen.findByRole('button', { name: 'Sí, rechazar' });
    await userEvent.dblClick(confirmar);
    await screen.findByRole('heading', { name: 'Solicitud aprobada' });
    expect(llamadas('/solicitudes/1/decision', 'PATCH')).toHaveLength(1);
  });

  it('409 muestra el mensaje y pasa a mostrar la decisión ya tomada', async () => {
    let decidida = false;
    montarPanel(
      <PantallaRevisionSolicitud idTexto="1" />,
      api({
        lectura: () => respuestaJson(decidida ? APROBADA : detalle()),
        patch: () => {
          decidida = true;
          return errorApi(409, 'La solicitud ya no está pendiente');
        },
      }),
    );
    await elegir('Rechazar la solicitud');
    await userEvent.type(screen.getByLabelText(/Motivo del rechazo/), 'No cumple');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, rechazar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La solicitud ya no está pendiente');
    expect(await screen.findByRole('heading', { name: 'Decisión' })).toBeInTheDocument();
    expect(screen.getByText('Bienvenida')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continuar' })).toBeNull();
  });

  it('404 al decidir muestra «No encontramos esta solicitud»', async () => {
    montarPanel(
      <PantallaRevisionSolicitud idTexto="1" />,
      api({ patch: () => errorApi(404, 'La solicitud no existe') }),
    );
    await elegir('Rechazar la solicitud');
    await userEvent.type(screen.getByLabelText(/Motivo del rechazo/), 'No cumple');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, rechazar' }));
    expect(await screen.findByText('No encontramos esta solicitud')).toBeInTheDocument();
  });

  it('un 400 por campo se muestra junto al campo y cierra el diálogo', async () => {
    montarPanel(
      <PantallaRevisionSolicitud idTexto="1" />,
      api({
        patch: () =>
          errorApi(400, 'Datos inválidos', [
            {
              campo: 'fechaEntrega',
              mensajes: ['La fecha de entrega no puede ser anterior a hoy'],
            },
          ]),
      }),
    );
    await elegir('Aprobar la solicitud');
    await userEvent.type(screen.getByLabelText(/Fecha de entrega/), '2099-01-01');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Sí, aprobar y crear la adopción' }),
    );
    expect(
      await screen.findByText('La fecha de entrega no puede ser anterior a hoy'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('429 muestra la espera con el diálogo cerrado y conserva el formulario', async () => {
    montarPanel(
      <PantallaRevisionSolicitud idTexto="1" />,
      api({ patch: () => errorApi(429, 'Demasiadas') }),
    );
    await elegir('Rechazar la solicitud');
    await userEvent.type(screen.getByLabelText(/Motivo del rechazo/), 'No cumple');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, rechazar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Espera un minuto');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByLabelText(/Motivo del rechazo/)).toHaveValue('No cumple');
  });

  it('una solicitud ya decidida muestra la decisión y ninguna acción', async () => {
    montarPanel(
      <PantallaRevisionSolicitud idTexto="1" />,
      api({ lectura: () => respuestaJson(APROBADA) }),
    );
    expect(await screen.findByRole('heading', { name: 'Decisión' })).toBeInTheDocument();
    expect(screen.getByText('5 de noviembre de 2026')).toBeInTheDocument();
    expect(screen.getByText('Bienvenida')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('una solicitud inexistente (404) o un id inválido no rompen la pantalla', async () => {
    montarPanel(
      <PantallaRevisionSolicitud idTexto="9" />,
      api({ lectura: () => errorApi(404, 'No existe') }),
    );
    expect(await screen.findByText('No encontramos esta solicitud')).toBeInTheDocument();
  });

  it('un id inválido no lanza peticiones', () => {
    const { fetchImpl } = montarPanel(<PantallaRevisionSolicitud idTexto="abc" />, api());
    expect(screen.getByText('No encontramos esta solicitud')).toBeInTheDocument();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
