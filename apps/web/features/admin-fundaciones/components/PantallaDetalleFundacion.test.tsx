import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorApi, montarPanel, respuestaJson } from '@/shared/testing/prueba-utils';
import { detalle } from '../prueba-datos';
import { PantallaDetalleFundacion } from './PantallaDetalleFundacion';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('estado=pendiente'),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/administrador/fundaciones/1',
}));
vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
const sesion = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }));
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => sesion.valor }));

beforeEach(() => {
  sesion.valor = { estado: 'autenticado', usuario: { id: 9, rol: 'administrador' } };
});

const APROBADA = detalle({ estadoValidacion: 'aprobada', fechaValidacion: '2026-11-05T15:00:00Z' });
const RECHAZADA = detalle({
  estadoValidacion: 'rechazada',
  observacionValidacion: 'Documento ilegible',
});

function api(
  opciones: { lectura?: () => Response; patch?: (c: Record<string, unknown>) => Response } = {},
) {
  return (_ruta: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      const cuerpo = JSON.parse(init.body as string) as Record<string, unknown>;
      return (opciones.patch ?? (() => respuestaJson(APROBADA)))(cuerpo);
    }
    return (opciones.lectura ?? (() => respuestaJson(detalle())))();
  };
}

describe('PantallaDetalleFundacion', () => {
  it('muestra datos, NIT, contacto y descarga del documento, sin claves de almacenamiento', async () => {
    const { container } = montarPanel(<PantallaDetalleFundacion idTexto="1" />, api());
    expect(await screen.findByRole('heading', { name: 'Patitas Felices' })).toBeInTheDocument();
    expect(screen.getByText('900123456-7')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'patitas@correo.co' })).toHaveAttribute(
      'href',
      'mailto:patitas@correo.co',
    );
    expect(screen.getByText('Calle 10 # 5-20')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar documento legal' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Volver a fundaciones/ })).toHaveAttribute(
      'href',
      '/administrador/fundaciones',
    );
    expect(container.innerHTML).not.toContain('privado/');
  });

  it('un id no numérico es «no encontrada» sin llamar a la API', () => {
    const { fetchImpl } = montarPanel(<PantallaDetalleFundacion idTexto="abc" />, api());
    expect(screen.getByRole('heading', { name: 'No encontramos esta fundación' })).toBeVisible();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('pendiente ofrece aprobar y rechazar; rechazada solo aprobar; aprobada ninguna', async () => {
    const vista = montarPanel(<PantallaDetalleFundacion idTexto="1" />, api());
    await screen.findByRole('button', { name: 'Aprobar' });
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeInTheDocument();
    vista.unmount();

    const v2 = montarPanel(
      <PantallaDetalleFundacion idTexto="1" />,
      api({ lectura: () => respuestaJson(RECHAZADA) }),
    );
    await screen.findByRole('button', { name: 'Aprobar' });
    expect(screen.queryByRole('button', { name: 'Rechazar' })).toBeNull();
    expect(screen.getByText('Documento ilegible')).toBeInTheDocument();
    v2.unmount();

    montarPanel(
      <PantallaDetalleFundacion idTexto="1" />,
      api({ lectura: () => respuestaJson(APROBADA) }),
    );
    await screen.findByRole('heading', { name: 'Patitas Felices' });
    expect(screen.queryByRole('button', { name: 'Aprobar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rechazar' })).toBeNull();
  });

  it('rechazar sin motivo muestra el error junto al campo, no abre el diálogo ni llama a la API', async () => {
    const { llamadas } = montarPanel(<PantallaDetalleFundacion idTexto="1" />, api());
    await userEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));
    expect(await screen.findByText('Indica el motivo del rechazo')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(llamadas('/admin/fundaciones/1/validacion', 'PATCH')).toHaveLength(0);
  });

  it('aprobar pide confirmación; «Volver» no envía; al confirmar envía y enfoca el resultado', async () => {
    let decidida = false;
    const { llamadas } = montarPanel(
      <PantallaDetalleFundacion idTexto="1" />,
      api({
        lectura: () => respuestaJson(decidida ? APROBADA : detalle()),
        patch: () => {
          decidida = true;
          return respuestaJson(APROBADA);
        },
      }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar' }));
    const dialogo = await screen.findByRole('dialog', { name: '¿Aprobar a Patitas Felices?' });
    await userEvent.click(screen.getByRole('button', { name: 'Volver' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(dialogo).not.toBeInTheDocument();
    expect(llamadas('/admin/fundaciones/1/validacion', 'PATCH')).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Aprobar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, aprobar' }));
    const titulo = await screen.findByRole('heading', { name: 'Fundación aprobada' });
    await waitFor(() => expect(titulo).toHaveFocus());
    expect(screen.getByText(/siguiente inicio de sesión/)).toBeInTheDocument();
    const patch = llamadas('/admin/fundaciones/1/validacion', 'PATCH');
    expect(patch).toHaveLength(1);
    expect(JSON.parse(patch[0]![1]!.body as string)).toEqual({ decision: 'aprobada' });
    expect(screen.queryByRole('button', { name: 'Aprobar' })).toBeNull();
  });

  it('rechazar con motivo envía la observación recortada', async () => {
    const { llamadas } = montarPanel(
      <PantallaDetalleFundacion idTexto="1" />,
      api({ patch: () => respuestaJson(detalle({ estadoValidacion: 'rechazada' })) }),
    );
    await userEvent.type(await screen.findByLabelText('Observación'), '  NIT no coincide  ');
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, rechazar' }));
    await screen.findByRole('heading', { name: 'Fundación rechazada' });
    expect(
      JSON.parse(llamadas('/admin/fundaciones/1/validacion', 'PATCH')[0]![1]!.body as string),
    ).toEqual({ decision: 'rechazada', observacion: 'NIT no coincide' });
  });

  it('409: muestra el mensaje del servidor, recarga el detalle y ajusta las acciones', async () => {
    let lecturas = 0;
    montarPanel(
      <PantallaDetalleFundacion idTexto="1" />,
      api({
        lectura: () => respuestaJson(++lecturas === 1 ? detalle() : APROBADA),
        patch: () => errorApi(409, 'La fundación ya está en estado aprobada'),
      }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, aprobar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La fundación ya está en estado aprobada',
    );
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Aprobar' })).toBeNull());
    expect(lecturas).toBeGreaterThanOrEqual(2);
  });

  it('400 de observación del servidor se pinta junto al campo', async () => {
    montarPanel(
      <PantallaDetalleFundacion idTexto="1" />,
      api({
        patch: () =>
          errorApi(400, 'Solicitud inválida', [
            {
              campo: 'observacion',
              mensajes: ['La observación no puede superar los 300 caracteres'],
            },
          ]),
      }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, aprobar' }));
    expect(await screen.findByText(/no puede superar los 300/)).toBeInTheDocument();
  });

  it('404 al decidir muestra «no encontramos esta fundación»', async () => {
    montarPanel(
      <PantallaDetalleFundacion idTexto="1" />,
      api({ patch: () => errorApi(404, 'No existe') }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, aprobar' }));
    expect(
      await screen.findByRole('heading', { name: 'No encontramos esta fundación' }),
    ).toBeInTheDocument();
  });

  it('error de carga: reintentar', async () => {
    montarPanel(<PantallaDetalleFundacion idTexto="1" />, () => errorApi(500, 'Falló'));
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
