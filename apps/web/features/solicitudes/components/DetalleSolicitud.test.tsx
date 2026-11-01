import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorApi, montarPanel, respuestaJson } from '@/shared/testing/prueba-utils';
import { detalle } from '../prueba-datos';
import { DetalleSolicitud } from './DetalleSolicitud';

const toasts = vi.hoisted(() => ({ exito: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('@/shared/ui/Toaster', () => ({ aviso: toasts, Toaster: () => null }));

let consulta = '';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(consulta),
}));
vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
vi.mock('@/shared/auth/SesionProvider', () => ({
  useSesion: () => ({ estado: 'autenticado', usuario: null }),
}));

beforeEach(() => {
  consulta = '';
});

const abrirDialogo = async () => {
  await userEvent.click(await screen.findByRole('button', { name: 'Cancelar solicitud' }));
  return screen.findByRole('dialog');
};

describe('DetalleSolicitud', () => {
  it('muestra los datos y vuelve a la lista con el mismo filtro y página', async () => {
    consulta = 'pagina=2&estado=pendiente';
    montarPanel(<DetalleSolicitud idTexto="1" />, () => respuestaJson(detalle()));
    expect(await screen.findByRole('heading', { name: /adoptar a Luna/ })).toBeInTheDocument();
    expect(screen.getByText('Tengo patio y tiempo')).toBeInTheDocument();
    expect(screen.getByText('Casa')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Volver a mis solicitudes/ })).toHaveAttribute(
      'href',
      '/adoptante/solicitudes?pagina=2&estado=pendiente',
    );
    expect(screen.queryByText('Observación de la fundación')).toBeNull();
  });

  it('una solicitud respondida muestra observación y fecha, y no ofrece cancelar', async () => {
    montarPanel(<DetalleSolicitud idTexto="1" />, () =>
      respuestaJson(
        detalle({
          estado: 'rechazada',
          observacion: 'Buscamos un hogar con patio cercado',
          fechaRespuesta: '2026-10-22T12:00:00.000Z',
        }),
      ),
    );
    expect(await screen.findByText('Buscamos un hogar con patio cercado')).toBeInTheDocument();
    expect(screen.getByText('Observación de la fundación')).toBeInTheDocument();
    expect(screen.getByText('Respondida el')).toBeInTheDocument();
    expect(screen.getByText('Rechazada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar solicitud' })).toBeNull();
  });

  it.each(['aprobada', 'cancelada'] as const)(
    'en estado %s no se puede cancelar',
    async (estado) => {
      montarPanel(<DetalleSolicitud idTexto="1" />, () => respuestaJson(detalle({ estado })));
      await screen.findByRole('heading', { name: /adoptar a Luna/ });
      expect(screen.queryByRole('button', { name: 'Cancelar solicitud' })).toBeNull();
    },
  );

  it('una solicitud ajena o inexistente (404) se ve como «no encontrada»', async () => {
    montarPanel(<DetalleSolicitud idTexto="9" />, () => errorApi(404, 'La solicitud no existe'));
    expect(
      await screen.findByRole('heading', { name: 'No encontramos esta solicitud' }),
    ).toBeInTheDocument();
  });

  it('un id inválido es «no encontrada» sin llamar a la API', () => {
    const { llamadas } = montarPanel(<DetalleSolicitud idTexto="abc" />, () => respuestaJson({}));
    expect(
      screen.getByRole('heading', { name: 'No encontramos esta solicitud' }),
    ).toBeInTheDocument();
    expect(llamadas('/mis-solicitudes')).toHaveLength(0);
  });

  it('cancelar pide confirmación: «No, conservarla» no llama a la API', async () => {
    const { llamadas } = montarPanel(<DetalleSolicitud idTexto="1" />, () =>
      respuestaJson(detalle()),
    );
    const dialogo = await abrirDialogo();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'No, conservarla' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(llamadas('/solicitudes/1/cancelar')).toHaveLength(0);
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
  });

  it('al confirmar, el estado pasa a «Cancelada» sin recargar y desaparece el botón', async () => {
    const { llamadas } = montarPanel(<DetalleSolicitud idTexto="1" />, (ruta, init) => {
      if (init?.method === 'PATCH') return respuestaJson(detalle({ estado: 'cancelada' }));
      return respuestaJson(detalle());
    });
    const dialogo = await abrirDialogo();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Sí, cancelar solicitud' }));
    expect(await screen.findByText('Cancelada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar solicitud' })).toBeNull();
    expect(screen.queryByText('Pendiente')).toBeNull();
    expect(llamadas('/solicitudes/1/cancelar', 'PATCH')).toHaveLength(1);
    expect(toasts.exito).toHaveBeenCalledWith('Solicitud cancelada.');
  });

  it('si la fundación se adelantó (409) avisa y muestra el estado vigente', async () => {
    let cancelada = false;
    montarPanel(<DetalleSolicitud idTexto="1" />, (ruta, init) => {
      if (init?.method === 'PATCH') {
        cancelada = true;
        return errorApi(
          409,
          'Una solicitud aprobada no se puede cancelar; contacta a la fundación',
        );
      }
      return respuestaJson(detalle(cancelada ? { estado: 'aprobada' } : {}));
    });
    const dialogo = await abrirDialogo();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Sí, cancelar solicitud' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/No se pudo cancelar/);
    expect(await screen.findByText('Aprobada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar solicitud' })).toBeNull();
  });
});
