import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  errorApi,
  montarPanel,
  respuestaJson,
  usuarioFundacion,
} from '@/shared/testing/prueba-utils';
import { detalleSeguimiento } from '../prueba-datos';
import { PantallaSeguimientoFundacion } from './PantallaSeguimientoFundacion';

vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
const sesion = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }));
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => sesion.valor }));

const crear = vi.fn(() => 'blob:foto');
const revocar = vi.fn();
beforeEach(() => {
  crear.mockClear();
  revocar.mockClear();
  URL.createObjectURL = crear;
  URL.revokeObjectURL = revocar;
  sesion.valor = {
    estado: 'autenticado',
    usuario: usuarioFundacion('aprobada'),
    refrescarPerfil: vi.fn(),
    cerrarSesion: vi.fn(),
  };
});

const REPORTE = {
  comentarios: 'Está feliz\ny come bien',
  enviadoEn: '2026-12-10T15:00:00.000Z',
  fotos: [
    { id: 11, url: '/api/fundacion/seguimientos/1/evidencias/11' },
    { id: 12, url: '/api/fundacion/seguimientos/1/evidencias/12' },
  ],
};
const png = (n = 'a.png') => new File([new Uint8Array(10)], n, { type: 'image/png' });
const imagen = () =>
  new Response(new Uint8Array([137, 80, 78, 71]), {
    status: 200,
    headers: { 'Content-Type': 'image/png' },
  });

/** Responde el detalle, las fotos y, si se pide, el PATCH de resultado. */
function api(opciones: { lectura: () => unknown; patch?: (init: RequestInit) => Response }) {
  return (ruta: string, init?: RequestInit) => {
    if (ruta.includes('/evidencias/')) return imagen();
    if (init?.method === 'PATCH') return opciones.patch!(init);
    if (ruta.startsWith('/fundacion/adopciones'))
      return respuestaJson({ total: 0, page: 1, limit: 10, data: [] });
    return respuestaJson(opciones.lectura());
  };
}

async function llenar(bienestar = 'Bueno') {
  await userEvent.type(screen.getByLabelText(/Fecha en que se realizó/), '2020-02-01');
  await userEvent.click(screen.getByRole('radio', { name: bienestar }));
  await userEvent.type(screen.getByLabelText(/Observaciones/), '  Todo bien  ');
}

describe('PantallaSeguimientoFundacion', () => {
  it('un reporte sin enviar muestra la espera y NO ofrece el formulario', async () => {
    montarPanel(
      <PantallaSeguimientoFundacion idTexto="1" />,
      api({ lectura: () => detalleSeguimiento({ tipo: 'reporte', tieneReporte: false }) }),
    );
    expect(
      await screen.findByText(/El adoptante aún no ha enviado su reporte/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar resultado' })).toBeNull();
    expect(screen.queryByLabelText(/Observaciones/)).toBeNull();
  });

  it('una visita pendiente ofrece el formulario sin sección de reporte', async () => {
    montarPanel(
      <PantallaSeguimientoFundacion idTexto="1" />,
      api({ lectura: () => detalleSeguimiento({ tipo: 'visita' }) }),
    );
    expect(await screen.findByRole('button', { name: 'Registrar resultado' })).toBeInTheDocument();
    expect(screen.queryByText('Reporte del adoptante')).toBeNull();
  });

  it('con reporte recibido muestra comentarios, fecha y fotos autenticadas, y el formulario', async () => {
    const { llamadas } = montarPanel(
      <PantallaSeguimientoFundacion idTexto="1" />,
      api({
        lectura: () =>
          detalleSeguimiento({ tipo: 'reporte', tieneReporte: true, reporte: REPORTE }),
      }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Reporte del adoptante' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Está feliz/)).toBeInTheDocument();
    expect(screen.getByText(/Enviado el 10 de diciembre de 2026/)).toBeInTheDocument();
    expect(
      await screen.findByRole('img', { name: 'Foto 1 del reporte del adoptante' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Foto 2 del reporte del adoptante' }),
    ).toBeInTheDocument();
    expect(llamadas('/fundacion/seguimientos/1/evidencias/11')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Registrar resultado' })).toBeInTheDocument();
  });

  it('las fotos se liberan al salir de la pantalla', async () => {
    const { unmount } = montarPanel(
      <PantallaSeguimientoFundacion idTexto="1" />,
      api({
        lectura: () =>
          detalleSeguimiento({ tipo: 'reporte', tieneReporte: true, reporte: REPORTE }),
      }),
    );
    await screen.findByRole('img', { name: 'Foto 2 del reporte del adoptante' });
    unmount();
    expect(revocar).toHaveBeenCalledWith('blob:foto');
  });

  it('el envío exige fecha, bienestar y observaciones y no llama a la API sin ellos', async () => {
    const { llamadas } = montarPanel(
      <PantallaSeguimientoFundacion idTexto="1" />,
      api({ lectura: () => detalleSeguimiento() }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar resultado' }));
    expect(
      await screen.findByText('Debes indicar la fecha en que se realizó el seguimiento'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('El estado de bienestar debe ser bueno, regular o malo'),
    ).toBeInTheDocument();
    expect(screen.getByText('Las observaciones son obligatorias')).toBeInTheDocument();
    expect(llamadas('/seguimientos/1/resultado', 'PATCH')).toHaveLength(0);
  });

  it('la fecha futura se rechaza en el cliente', async () => {
    const { llamadas } = montarPanel(
      <PantallaSeguimientoFundacion idTexto="1" />,
      api({ lectura: () => detalleSeguimiento() }),
    );
    await screen.findByRole('button', { name: 'Registrar resultado' });
    await userEvent.type(screen.getByLabelText(/Fecha en que se realizó/), '2099-01-01');
    await userEvent.click(screen.getByRole('radio', { name: 'Bueno' }));
    await userEvent.type(screen.getByLabelText(/Observaciones/), 'ok');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar resultado' }));
    expect(await screen.findByText('La fecha realizada no puede ser futura')).toBeInTheDocument();
    expect(llamadas('/seguimientos/1/resultado', 'PATCH')).toHaveLength(0);
  });

  it('envía multipart con evidencias, muestra el resultado y la alerta si el bienestar es malo, y enfoca el encabezado', async () => {
    let cuerpo: FormData | null = null;
    let hecho = false;
    montarPanel(
      <PantallaSeguimientoFundacion idTexto="1" />,
      api({
        lectura: () =>
          hecho
            ? detalleSeguimiento({
                estado: 'realizado',
                fechaRealizada: '2020-02-01',
                estadoBienestar: 'malo',
                observaciones: 'Todo mal',
                evidencias: [{ id: 5, url: '/api/fundacion/seguimientos/1/evidencias/5' }],
              })
            : detalleSeguimiento(),
        patch: (init) => {
          cuerpo = init.body as FormData;
          hecho = true;
          return respuestaJson(
            detalleSeguimiento({
              estado: 'realizado',
              fechaRealizada: '2020-02-01',
              estadoBienestar: 'malo',
              observaciones: 'Todo mal',
              evidencias: [{ id: 5, url: '/api/fundacion/seguimientos/1/evidencias/5' }],
            }),
          );
        },
      }),
    );
    await screen.findByRole('button', { name: 'Registrar resultado' });
    await llenar('Malo');
    await userEvent.upload(screen.getByLabelText(/Evidencias/), [png('a.png'), png('b.png')], {
      applyAccept: false,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Registrar resultado' }));
    const titulo = await screen.findByRole('heading', { name: 'Resultado registrado' });
    expect(cuerpo!.get('fechaRealizada')).toBe('2020-02-01');
    expect(cuerpo!.get('estadoBienestar')).toBe('malo');
    expect(cuerpo!.get('observaciones')).toBe('Todo bien');
    expect(cuerpo!.getAll('evidencias')).toHaveLength(2);
    await waitFor(() => expect(titulo).toHaveFocus());
    const alertas = screen.getAllByRole('alert');
    expect(alertas.some((a) => /Estado de bienestar malo/.test(a.textContent ?? ''))).toBe(true);
    expect(
      await screen.findByRole('img', { name: 'Evidencia 1 del seguimiento' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar resultado' })).toBeNull();
  });

  it('un bienestar bueno no muestra la alerta', async () => {
    montarPanel(
      <PantallaSeguimientoFundacion idTexto="1" />,
      api({
        lectura: () =>
          detalleSeguimiento({
            estado: 'realizado',
            fechaRealizada: '2020-02-01',
            estadoBienestar: 'bueno',
            observaciones: 'Bien',
          }),
      }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Resultado registrado' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Estado de bienestar malo')).toBeNull();
    expect(screen.getByText('Bueno')).toBeInTheDocument();
  });

  it('409 muestra el mensaje y relee el detalle ya realizado', async () => {
    let realizado = false;
    montarPanel(
      <PantallaSeguimientoFundacion idTexto="1" />,
      api({
        lectura: () =>
          realizado
            ? detalleSeguimiento({
                estado: 'realizado',
                fechaRealizada: '2020-02-01',
                estadoBienestar: 'regular',
                observaciones: 'Lo registró otro',
              })
            : detalleSeguimiento(),
        patch: () => {
          realizado = true;
          return errorApi(409, 'El seguimiento ya está realizado');
        },
      }),
    );
    await screen.findByRole('button', { name: 'Registrar resultado' });
    await llenar();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar resultado' }));
    expect(await screen.findByText('El seguimiento ya está realizado')).toBeInTheDocument();
    expect(await screen.findByText('Lo registró otro')).toBeInTheDocument();
  });

  it('429 conserva el formulario y las fotos elegidas', async () => {
    montarPanel(
      <PantallaSeguimientoFundacion idTexto="1" />,
      api({
        lectura: () => detalleSeguimiento(),
        patch: () => errorApi(429, 'Demasiados'),
      }),
    );
    await screen.findByRole('button', { name: 'Registrar resultado' });
    await llenar();
    await userEvent.upload(screen.getByLabelText(/Evidencias/), [png('a.png')], {
      applyAccept: false,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Registrar resultado' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Espera un minuto');
    expect(screen.getByLabelText(/Observaciones/)).toHaveValue('  Todo bien  ');
    expect(screen.getByText('a.png')).toBeInTheDocument();
  });

  it('un 400 de archivo se muestra junto al campo de evidencias', async () => {
    montarPanel(
      <PantallaSeguimientoFundacion idTexto="1" />,
      api({
        lectura: () => detalleSeguimiento(),
        patch: () =>
          errorApi(400, 'Datos inválidos', [
            { campo: 'evidencias', mensajes: ['El archivo no es una imagen válida'] },
          ]),
      }),
    );
    await screen.findByRole('button', { name: 'Registrar resultado' });
    await llenar();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar resultado' }));
    expect(await screen.findByText('El archivo no es una imagen válida')).toBeInTheDocument();
  });

  it('un seguimiento cancelado se muestra en solo lectura', async () => {
    montarPanel(
      <PantallaSeguimientoFundacion idTexto="1" />,
      api({ lectura: () => detalleSeguimiento({ estado: 'cancelado' }) }),
    );
    expect(
      await screen.findByText('Este seguimiento se canceló al cerrarse la adopción.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar resultado' })).toBeNull();
  });

  it('un vencido se marca con texto y el formulario sigue disponible', async () => {
    montarPanel(
      <PantallaSeguimientoFundacion idTexto="1" />,
      api({ lectura: () => detalleSeguimiento({ estado: 'vencido', vencido: true }) }),
    );
    const cabecera = await screen.findByRole('heading', { name: /Visita de seguimiento de Luna/ });
    expect(
      within(cabecera.parentElement!).getByText(/Venció el 15 de diciembre de 2026/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar resultado' })).toBeInTheDocument();
  });

  it('404 e id inválido muestran «No encontramos este seguimiento» sin peticiones inválidas', async () => {
    const a = montarPanel(<PantallaSeguimientoFundacion idTexto="9" />, () =>
      errorApi(404, 'El seguimiento no existe'),
    );
    expect(await screen.findByText('No encontramos este seguimiento')).toBeInTheDocument();
    a.unmount();
    const b = montarPanel(<PantallaSeguimientoFundacion idTexto="x" />, () => respuestaJson({}));
    expect(screen.getByText('No encontramos este seguimiento')).toBeInTheDocument();
    expect(b.fetchImpl).not.toHaveBeenCalled();
  });
});
