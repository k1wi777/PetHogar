import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorApi, montarPanel, respuestaJson } from '@/shared/testing/prueba-utils';
import { FormularioDonacion } from './FormularioDonacion';

vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
vi.mock('@/shared/auth/SesionProvider', () => ({
  useSesion: () => ({ estado: 'autenticado', usuario: null }),
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('') }));

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:c');
  URL.revokeObjectURL = vi.fn();
});

const FUNDACION = { id: 3, nombre: 'Patitas' };
const REGISTRADA = (p = {}) => ({
  id: 1,
  fundacion: { id: 3, nombre: 'Patitas' },
  tipo: 'economica',
  monto: '50000.50',
  descripcionEspecie: null,
  fecha: '2026-10-30T10:00:00.000Z',
  comprobante: false,
  ...p,
});
const montar = (manejador = () => respuestaJson(REGISTRADA(), 201)) =>
  montarPanel(<FormularioDonacion fundacion={FUNDACION} />, manejador);
const tipo = (nombre: RegExp) => userEvent.click(screen.getByRole('radio', { name: nombre }));
const revisar = () => userEvent.click(screen.getByRole('button', { name: 'Revisar y registrar' }));
const confirmar = async () =>
  userEvent.click(
    within(await screen.findByRole('dialog')).getByRole('button', {
      name: 'Sí, registrar donación',
    }),
  );

describe('FormularioDonacion', () => {
  it('muestra la fundación fija, sin selector, y el aviso de que no hay pagos', () => {
    montar();
    expect(screen.getByText('Patitas')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByRole('note')).toHaveTextContent('PetHogar no procesa pagos');
  });

  it('los campos dependen del tipo y se limpia el que sale de pantalla', async () => {
    montar();
    expect(screen.queryByLabelText(/Monto/)).toBeNull();
    expect(screen.queryByLabelText(/¿Qué donaste\?/)).toBeNull();
    await tipo(/Económica/);
    await userEvent.type(screen.getByLabelText(/Monto en pesos/), '123');
    expect(screen.queryByLabelText(/¿Qué donaste\?/)).toBeNull();
    await tipo(/En especie/);
    expect(screen.queryByLabelText(/Monto en pesos/)).toBeNull();
    expect(screen.getByLabelText(/¿Qué donaste\?/)).toBeInTheDocument();
    await tipo(/Económica/);
    expect(screen.getByLabelText(/Monto en pesos/)).toHaveValue('');
  });

  it('exige elegir el tipo antes de continuar', async () => {
    montar();
    await revisar();
    expect(await screen.findByText('Elige el tipo de donación')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each([
    ['0', 'El monto debe ser mayor que 0'],
    ['-5', 'Usa solo números y punto decimal, hasta 2 decimales'],
    ['1.234', 'Usa solo números y punto decimal, hasta 2 decimales'],
    ['1000000000.01', 'El monto no puede superar $ 1.000.000.000'],
    ['', 'Indica el monto de la donación económica'],
  ])('rechaza el monto «%s» antes de enviar', async (monto, mensaje) => {
    const { llamadas } = montar();
    await tipo(/Económica/);
    if (monto) await userEvent.type(screen.getByLabelText(/Monto en pesos/), monto);
    await revisar();
    expect(await screen.findByText(mensaje)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(llamadas('/donaciones')).toHaveLength(0);
  });

  it('económica: pide confirmación y envía el monto como cadena, sin convertirlo', async () => {
    const { llamadas } = montar();
    await tipo(/Económica/);
    await userEvent.type(screen.getByLabelText(/Monto en pesos/), '50000.50');
    await revisar();
    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveTextContent('Patitas');
    expect(dialogo).toHaveTextContent('$ 50.000,50');
    expect(dialogo).toHaveTextContent('no procesa pagos');
    expect(llamadas('/donaciones')).toHaveLength(0);
    await confirmar();
    expect(
      await screen.findByRole('heading', { name: 'Registramos tu donación' }),
    ).toBeInTheDocument();
    const cuerpo = llamadas('/donaciones', 'POST')[0]![1]!.body as FormData;
    expect(cuerpo.get('fundacionId')).toBe('3');
    expect(cuerpo.get('tipo')).toBe('economica');
    expect(cuerpo.get('monto')).toBe('50000.50');
    expect(cuerpo.has('descripcion')).toBe(false);
    expect(cuerpo.has('comprobante')).toBe(false);
    expect(screen.getByRole('note')).toHaveTextContent('PetHogar no procesa pagos');
  });

  it('«Volver» en el diálogo no registra nada', async () => {
    const { llamadas } = montar();
    await tipo(/Económica/);
    await userEvent.type(screen.getByLabelText(/Monto en pesos/), '10');
    await revisar();
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Volver' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(llamadas('/donaciones')).toHaveLength(0);
  });

  it('en especie envía la descripción y el comprobante, sin monto', async () => {
    const { llamadas } = montar(() =>
      respuestaJson(
        REGISTRADA({
          tipo: 'especie',
          monto: null,
          descripcionEspecie: '10 kg de croquetas',
          comprobante: true,
        }),
        201,
      ),
    );
    await tipo(/En especie/);
    await userEvent.type(screen.getByLabelText(/¿Qué donaste\?/), '  10 kg de croquetas ');
    await userEvent.upload(
      screen.getByLabelText(/Comprobante/),
      new File(['%PDF-1'], 'rec.pdf', { type: 'application/pdf' }),
      { applyAccept: false },
    );
    await revisar();
    await confirmar();
    expect(await screen.findByText(/10 kg de croquetas/)).toBeInTheDocument();
    const cuerpo = llamadas('/donaciones', 'POST')[0]![1]!.body as FormData;
    expect(cuerpo.get('tipo')).toBe('especie');
    expect(cuerpo.get('descripcion')).toBe('10 kg de croquetas');
    expect(cuerpo.has('monto')).toBe(false);
    expect((cuerpo.get('comprobante') as File).name).toBe('rec.pdf');
  });

  it('un comprobante inválido se rechaza al elegirlo', async () => {
    montar();
    await userEvent.upload(
      screen.getByLabelText(/Comprobante/),
      new File(['x'], 'a.gif', { type: 'image/gif' }),
      { applyAccept: false },
    );
    expect(await screen.findByText('Solo se permiten archivos JPG, PNG o PDF')).toBeInTheDocument();
  });

  it('permite registrar otra donación con el formulario limpio', async () => {
    montar();
    await tipo(/Económica/);
    await userEvent.type(screen.getByLabelText(/Monto en pesos/), '10');
    await revisar();
    await confirmar();
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar otra donación' }));
    expect(screen.getByRole('radio', { name: /Económica/ })).not.toBeChecked();
  });

  it('muestra el rechazo de la API (fundación sin donaciones) en un aviso', async () => {
    montar(() => errorApi(404, 'La fundación no existe o no recibe donaciones'));
    await tipo(/Económica/);
    await userEvent.type(screen.getByLabelText(/Monto en pesos/), '10');
    await revisar();
    await confirmar();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La fundación no existe o no recibe donaciones',
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('un 400 del monto va junto al campo', async () => {
    montar(() =>
      errorApi(400, 'Los datos enviados no son válidos', [
        { campo: 'monto', mensajes: ['El monto debe ser mayor que 0'] },
      ]),
    );
    await tipo(/Económica/);
    await userEvent.type(screen.getByLabelText(/Monto en pesos/), '10');
    await revisar();
    await confirmar();
    expect(await screen.findByText('El monto debe ser mayor que 0')).toBeInTheDocument();
  });
});
