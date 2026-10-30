import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorApi, montarPanel, respuestaJson } from '@/shared/testing/prueba-utils';
import { detalleSeguimiento } from '../prueba-datos';
import { PantallaSeguimiento } from './PantallaSeguimiento';

vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
vi.mock('@/shared/auth/SesionProvider', () => ({
  useSesion: () => ({ estado: 'autenticado', usuario: null }),
}));

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:f');
  URL.revokeObjectURL = vi.fn();
});

const REPORTE = {
  comentarios: 'Está feliz',
  enviadoEn: '2026-12-10T15:00:00.000Z',
  fotos: [
    { id: 1, url: '/x' },
    { id: 2, url: '/y' },
  ],
};
const png = (n = 'luna.png') => new File([new Uint8Array(10)], n, { type: 'image/png' });

describe('PantallaSeguimiento', () => {
  it('un reporte programado muestra el formulario', async () => {
    montarPanel(<PantallaSeguimiento idTexto="1" />, () => respuestaJson(detalleSeguimiento()));
    expect(await screen.findByLabelText(/Cuéntanos cómo está la mascota/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Fotos/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar reporte' })).toBeInTheDocument();
  });

  it('un vencido también muestra el formulario, con el aviso de vencido', async () => {
    montarPanel(<PantallaSeguimiento idTexto="1" />, () =>
      respuestaJson(detalleSeguimiento({ estado: 'vencido', vencido: true })),
    );
    expect(await screen.findByRole('button', { name: 'Enviar reporte' })).toBeInTheDocument();
    expect(screen.getByText('Vencido')).toBeInTheDocument();
    expect(screen.getByText(/Venció el 15 de diciembre de 2026/)).toBeInTheDocument();
  });

  it('el envío exige comentarios y no llama a la API sin ellos', async () => {
    const { llamadas } = montarPanel(<PantallaSeguimiento idTexto="1" />, () =>
      respuestaJson(detalleSeguimiento()),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Enviar reporte' }));
    expect(
      await screen.findByText('Cuéntanos cómo está la mascota', { selector: 'p' }),
    ).toBeInTheDocument();
    expect(llamadas('/seguimientos/1/reporte')).toHaveLength(0);
  });

  it('envía multipart y, al recibirlo, muestra «Reporte recibido» y bloquea el formulario', async () => {
    const { llamadas } = montarPanel(<PantallaSeguimiento idTexto="1" />, (ruta, init) => {
      if (init?.method === 'POST') {
        return respuestaJson(detalleSeguimiento({ tieneReporte: true, reporte: REPORTE }), 201);
      }
      return respuestaJson(detalleSeguimiento());
    });
    await userEvent.type(
      await screen.findByLabelText(/Cuéntanos cómo está la mascota/),
      '  Está feliz ',
    );
    await userEvent.upload(screen.getByLabelText(/Fotos/), [png('a.png'), png('b.png')], {
      applyAccept: false,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }));
    await screen.findByText('Enviaste 2 fotos.');
    const estado = screen.getByRole('status');
    expect(estado).toHaveTextContent('Reporte recibido');
    expect(estado).toHaveTextContent('Enviaste 2 fotos');
    expect(estado).toHaveTextContent('Está feliz');
    await waitFor(() => expect(estado).toHaveFocus());
    expect(screen.queryByRole('button', { name: 'Enviar reporte' })).toBeNull();
    expect(screen.queryByLabelText(/Cuéntanos cómo está la mascota/)).toBeNull();
    const cuerpo = llamadas('/seguimientos/1/reporte', 'POST')[0]![1]!.body as FormData;
    expect(cuerpo.get('comentarios')).toBe('Está feliz');
    expect(cuerpo.getAll('fotos')).toHaveLength(2);
  });

  it('el bloqueo se deriva del servidor: con reporte existente no hay formulario al entrar', async () => {
    montarPanel(<PantallaSeguimiento idTexto="1" />, () =>
      respuestaJson(detalleSeguimiento({ tieneReporte: true, reporte: { ...REPORTE, fotos: [] } })),
    );
    expect(await screen.findByText('No enviaste fotos.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Reporte recibido');
    expect(screen.queryByRole('button', { name: 'Enviar reporte' })).toBeNull();
  });

  it('una visita explica por qué no hay formulario', async () => {
    montarPanel(<PantallaSeguimiento idTexto="1" />, () =>
      respuestaJson(detalleSeguimiento({ tipo: 'visita' })),
    );
    expect(await screen.findByText(/es una visita/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar reporte' })).toBeNull();
  });

  it.each(['realizado', 'cancelado'] as const)(
    'un seguimiento %s está cerrado, sin formulario',
    async (estado) => {
      montarPanel(<PantallaSeguimiento idTexto="1" />, () =>
        respuestaJson(detalleSeguimiento({ estado })),
      );
      expect(await screen.findByText(/ya está cerrado/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Enviar reporte' })).toBeNull();
    },
  );

  it('404 o id inválido ⇒ no encontrado (el id inválido sin llamar a la API)', async () => {
    const a = montarPanel(<PantallaSeguimiento idTexto="9" />, () =>
      errorApi(404, 'El seguimiento no existe'),
    );
    expect(
      await screen.findByRole('heading', { name: 'No encontramos este seguimiento' }),
    ).toBeInTheDocument();
    a.unmount();
    const b = montarPanel(<PantallaSeguimiento idTexto="x" />, () => respuestaJson({}));
    expect(
      screen.getByRole('heading', { name: 'No encontramos este seguimiento' }),
    ).toBeInTheDocument();
    expect(b.llamadas('/mis-seguimientos')).toHaveLength(0);
  });

  it('un 409 al enviar muestra el motivo del servidor', async () => {
    montarPanel(<PantallaSeguimiento idTexto="1" />, (ruta, init) =>
      init?.method === 'POST'
        ? errorApi(409, 'Este seguimiento es una visita y no admite reporte')
        : respuestaJson(detalleSeguimiento()),
    );
    await userEvent.type(await screen.findByLabelText(/Cuéntanos cómo está la mascota/), 'bien');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('no admite reporte');
  });
});
