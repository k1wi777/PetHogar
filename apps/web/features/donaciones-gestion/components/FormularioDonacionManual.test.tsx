import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorApi, montarPanel, respuestaJson } from '@/shared/testing/prueba-utils';
import { donacion } from '../prueba-datos';
import { FormularioDonacionManual } from './FormularioDonacionManual';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/fundacion/donaciones/nueva',
}));
vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
const aviso = vi.hoisted(() => ({ exito: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('@/shared/ui/Toaster', () => ({ aviso }));
vi.mock('@/shared/auth/SesionProvider', () => ({
  useSesion: () => ({ estado: 'autenticado', usuario: null }),
}));

beforeEach(() => {
  push.mockClear();
  aviso.exito.mockClear();
  URL.createObjectURL = vi.fn(() => 'blob:c');
  URL.revokeObjectURL = vi.fn();
});

const pdf = (n = 'comprobante.pdf') =>
  new File([new Uint8Array(10)], n, { type: 'application/pdf' });

async function basico(tipo: 'Económica' | 'En especie') {
  await userEvent.type(screen.getByLabelText(/Nombre del donante/), '  María Gómez ');
  await userEvent.click(screen.getByRole('radio', { name: new RegExp(tipo) }));
}
const enviar = () => userEvent.click(screen.getByRole('button', { name: 'Registrar aporte' }));

describe('FormularioDonacionManual', () => {
  it('muestra solo el campo que corresponde al tipo', async () => {
    montarPanel(<FormularioDonacionManual />, () => respuestaJson(donacion(), 201));
    expect(screen.queryByLabelText(/Monto en pesos/)).toBeNull();
    expect(screen.queryByLabelText(/¿Qué donó\?/)).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: /Económica/ }));
    expect(screen.getByLabelText(/Monto en pesos/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/¿Qué donó\?/)).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: /En especie/ }));
    expect(screen.getByLabelText(/¿Qué donó\?/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Monto en pesos/)).toBeNull();
  });

  it.each([
    ['0', 'El monto debe ser mayor que 0'],
    ['12,345', 'Usa solo números y punto decimal, hasta 2 decimales'],
    ['1000000000.01', 'El monto no puede superar $ 1.000.000.000'],
    ['', 'Indica el monto de la donación económica'],
  ])('monto %j se rechaza en el cliente sin llamar a la API', async (monto, mensaje) => {
    const { llamadas } = montarPanel(<FormularioDonacionManual />, () =>
      respuestaJson(donacion(), 201),
    );
    await basico('Económica');
    if (monto) await userEvent.type(screen.getByLabelText(/Monto en pesos/), monto);
    await enviar();
    expect(await screen.findByText(mensaje)).toBeInTheDocument();
    expect(llamadas('/fundacion/donaciones', 'POST')).toHaveLength(0);
  });

  it('la descripción es obligatoria en especie', async () => {
    const { llamadas } = montarPanel(<FormularioDonacionManual />, () =>
      respuestaJson(donacion(), 201),
    );
    await basico('En especie');
    await enviar();
    expect(
      await screen.findByText('Describe lo que donas (entre 1 y 300 caracteres)'),
    ).toBeInTheDocument();
    expect(llamadas('/fundacion/donaciones', 'POST')).toHaveLength(0);
  });

  it('económica: envía el monto como cadena con punto, con comprobante y sin descripción; confirma y vuelve a la lista', async () => {
    let cuerpo: FormData | null = null;
    const { llamadas } = montarPanel(<FormularioDonacionManual />, (ruta, init) => {
      cuerpo = init!.body as FormData;
      return respuestaJson(donacion(), 201);
    });
    await basico('Económica');
    await userEvent.type(screen.getByLabelText(/Monto en pesos/), '50000,50');
    await userEvent.upload(screen.getByLabelText(/Comprobante/), pdf(), { applyAccept: false });
    await enviar();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/fundacion/donaciones?registrado=1'));
    expect(llamadas('/fundacion/donaciones', 'POST')).toHaveLength(1);
    expect(cuerpo!.get('nombreDonante')).toBe('María Gómez');
    expect(cuerpo!.get('tipo')).toBe('economica');
    expect(cuerpo!.get('monto')).toBe('50000.50');
    expect(cuerpo!.has('descripcion')).toBe(false);
    expect((cuerpo!.get('comprobante') as File).name).toBe('comprobante.pdf');
    expect(aviso.exito).toHaveBeenCalledWith('Aporte de María Gómez registrado');
  });

  it('en especie: envía la descripción sin monto ni comprobante', async () => {
    let cuerpo: FormData | null = null;
    montarPanel(<FormularioDonacionManual />, (ruta, init) => {
      cuerpo = init!.body as FormData;
      return respuestaJson(donacion({ tipo: 'especie' }), 201);
    });
    await basico('En especie');
    await userEvent.type(screen.getByLabelText(/¿Qué donó\?/), '10 bultos de alimento');
    await enviar();
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(cuerpo!.get('tipo')).toBe('especie');
    expect(cuerpo!.get('descripcion')).toBe('10 bultos de alimento');
    expect(cuerpo!.has('monto')).toBe(false);
    expect(cuerpo!.has('comprobante')).toBe(false);
  });

  it('cambiar de tipo no arrastra el campo anterior', async () => {
    let cuerpo: FormData | null = null;
    montarPanel(<FormularioDonacionManual />, (ruta, init) => {
      cuerpo = init!.body as FormData;
      return respuestaJson(donacion({ tipo: 'especie' }), 201);
    });
    await basico('Económica');
    await userEvent.type(screen.getByLabelText(/Monto en pesos/), '5000');
    await userEvent.click(screen.getByRole('radio', { name: /En especie/ }));
    await userEvent.type(screen.getByLabelText(/¿Qué donó\?/), 'Mantas');
    await enviar();
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(cuerpo!.has('monto')).toBe(false);
    expect(cuerpo!.get('descripcion')).toBe('Mantas');
  });

  it('los errores del backend se muestran junto al campo', async () => {
    montarPanel(<FormularioDonacionManual />, () =>
      errorApi(400, 'Datos inválidos', [
        { campo: 'monto', mensajes: ['El monto no puede superar $ 1.000.000.000'] },
      ]),
    );
    await basico('Económica');
    await userEvent.type(screen.getByLabelText(/Monto en pesos/), '5000');
    await enviar();
    expect(
      await screen.findByText('El monto no puede superar $ 1.000.000.000'),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('413 del comprobante se muestra junto al comprobante', async () => {
    montarPanel(<FormularioDonacionManual />, () =>
      errorApi(413, 'El archivo supera el tamaño permitido'),
    );
    await basico('En especie');
    await userEvent.type(screen.getByLabelText(/¿Qué donó\?/), 'Mantas');
    await enviar();
    expect(await screen.findByText('El archivo supera el tamaño permitido')).toBeInTheDocument();
  });

  it('429 conserva el formulario y muestra la espera', async () => {
    montarPanel(<FormularioDonacionManual />, () => errorApi(429, 'x'));
    await basico('En especie');
    await userEvent.type(screen.getByLabelText(/¿Qué donó\?/), 'Mantas');
    await enviar();
    expect(await screen.findByRole('alert')).toHaveTextContent('Espera un minuto');
    expect(screen.getByLabelText(/¿Qué donó\?/)).toHaveValue('Mantas');
    expect(screen.getByLabelText(/Nombre del donante/)).toHaveValue('  María Gómez ');
    expect(push).not.toHaveBeenCalled();
  });

  it('un doble envío manda una sola petición', async () => {
    const { llamadas } = montarPanel(<FormularioDonacionManual />, async () => {
      await new Promise((r) => setTimeout(r, 50));
      return respuestaJson(donacion({ tipo: 'especie' }), 201);
    });
    await basico('En especie');
    await userEvent.type(screen.getByLabelText(/¿Qué donó\?/), 'Mantas');
    await userEvent.dblClick(screen.getByRole('button', { name: 'Registrar aporte' }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(llamadas('/fundacion/donaciones', 'POST')).toHaveLength(1);
  });
});
