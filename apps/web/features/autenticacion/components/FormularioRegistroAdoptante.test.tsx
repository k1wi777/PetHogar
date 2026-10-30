import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cuerpoJson, errorApi, montar, respuestaJson } from '../prueba-utils';
import { FormularioRegistroAdoptante } from './FormularioRegistroAdoptante';

vi.mock('@/shared/api/http', () =>
  import('../http-prueba').then((m) => ({ http: m.httpSimulado })),
);
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/registro',
}));
vi.mock('@/shared/ui/Toaster', () => ({
  aviso: { exito: vi.fn(), error: vi.fn(), info: vi.fn() },
  Toaster: () => null,
}));

beforeEach(() => {
  document.cookie = 'ph_rol=; Path=/; Max-Age=0';
});

async function llenar(opciones: { sinPolitica?: boolean; fecha?: string } = {}) {
  const u = userEvent;
  await u.type(screen.getByLabelText(/Primer nombre/), 'Ana');
  await u.type(screen.getByLabelText(/Primer apellido/), 'Pérez');
  await u.click(screen.getByRole('combobox', { name: /Tipo de documento/ }));
  await u.click(await screen.findByRole('option', { name: /Cédula de ciudadanía/ }));
  await u.type(screen.getByLabelText(/Número de documento/), 'ABC1234');
  await u.type(screen.getByLabelText(/Fecha de nacimiento/), opciones.fecha ?? '1990-05-10');
  await u.type(screen.getByLabelText(/Teléfono/), '3001234567');
  await u.type(screen.getByLabelText(/Correo electrónico/), 'Ana@Correo.co');
  await u.type(screen.getByLabelText(/Dirección/), 'Calle 1 # 2-3');
  await u.type(screen.getByLabelText(/Ciudad/), 'Montería');
  await u.type(screen.getByLabelText(/^Contraseña/, { selector: 'input' }), 'Clave1234');
  if (!opciones.sinPolitica) await u.click(screen.getByRole('checkbox', { name: /política/ }));
}
const enviar = () => userEvent.click(screen.getByRole('button', { name: 'Crear mi cuenta' }));

describe('FormularioRegistroAdoptante', () => {
  it('registra con todos los campos y muestra «Revisa tu correo» con el correo usado', async () => {
    const { llamadas } = montar(<FormularioRegistroAdoptante />, () =>
      respuestaJson({ mensaje: 'Registro exitoso' }, 201),
    );
    await llenar();
    await enviar();
    expect(await screen.findByRole('heading', { name: 'Revisa tu correo' })).toBeInTheDocument();
    expect(screen.getByText('ana@correo.co')).toBeInTheDocument();
    expect(cuerpoJson(llamadas('/auth/register/adoptante')[0]!)).toEqual({
      primerNombre: 'Ana',
      primerApellido: 'Pérez',
      tipoDocumento: 'CC',
      numeroDocumento: 'ABC1234',
      fechaNacimiento: '1990-05-10',
      telefono: '3001234567',
      email: 'ana@correo.co',
      direccion: 'Calle 1 # 2-3',
      ciudad: 'Montería',
      contrasena: 'Clave1234',
      aceptaPoliticaDatos: true,
    });
  });

  it('la vista «revisa tu correo» permite reenviar el enlace', async () => {
    const { llamadas } = montar(<FormularioRegistroAdoptante />, (ruta) =>
      ruta === '/auth/verify-email/resend'
        ? respuestaJson({ mensaje: 'Te enviaremos un nuevo enlace.' })
        : respuestaJson({ mensaje: 'ok' }, 201),
    );
    await llenar();
    await enviar();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Reenviar enlace de verificación' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Te enviaremos un nuevo enlace.');
    expect(cuerpoJson(llamadas('/auth/verify-email/resend')[0]!)).toEqual({
      email: 'ana@correo.co',
    });
  });

  it('valida en el cliente: sin política ni datos no llama al servidor y enfoca el primer error', async () => {
    const { llamadas } = montar(<FormularioRegistroAdoptante />, () => errorApi(500, 'x'));
    await enviar();
    expect(await screen.findByText('El primer nombre es obligatorio')).toBeInTheDocument();
    expect(
      screen.getByText('Debes aceptar la política de tratamiento de datos personales'),
    ).toBeInTheDocument();
    expect(llamadas('/auth/register')).toHaveLength(0);
    await waitFor(() => expect(screen.getByLabelText(/Primer nombre/)).toHaveFocus());
  });

  it('rechaza a un menor de edad junto al campo de fecha', async () => {
    const { llamadas } = montar(<FormularioRegistroAdoptante />, () => errorApi(500, 'x'));
    const hoy = new Date();
    const reciente = `${hoy.getUTCFullYear() - 10}-01-01`;
    await llenar({ fecha: reciente });
    await enviar();
    expect(
      await screen.findByText('Debes ser mayor de 18 años para registrarte'),
    ).toBeInTheDocument();
    expect(llamadas('/auth/register')).toHaveLength(0);
  });

  it('correo duplicado (409): el mensaje aparece junto al campo de correo', async () => {
    montar(<FormularioRegistroAdoptante />, () =>
      errorApi(409, 'Ya existe una cuenta registrada con este correo'),
    );
    await llenar();
    await enviar();
    const entrada = screen.getByLabelText(/Correo electrónico/);
    await waitFor(() => expect(entrada).toHaveAttribute('aria-invalid', 'true'));
    expect(entrada).toHaveAccessibleDescription('Ya existe una cuenta registrada con este correo');
    await waitFor(() => expect(entrada).toHaveFocus());
  });

  it('documento duplicado (409) va al campo del número de documento', async () => {
    montar(<FormularioRegistroAdoptante />, () =>
      errorApi(409, 'Ya existe una cuenta registrada con este número de documento'),
    );
    await llenar();
    await enviar();
    const entrada = screen.getByLabelText(/Número de documento/);
    await waitFor(() =>
      expect(entrada).toHaveAccessibleDescription(
        'Ya existe una cuenta registrada con este número de documento',
      ),
    );
  });

  it('errores de validación del servidor por campo; los desconocidos van al aviso', async () => {
    montar(<FormularioRegistroAdoptante />, () =>
      errorApi(400, 'Los datos enviados no son válidos', [
        {
          campo: 'telefono',
          mensajes: ['El teléfono debe tener entre 7 y 14 dígitos (puede iniciar con +)'],
        },
        { campo: 'otro', mensajes: ['Algo más falló'] },
      ]),
    );
    await llenar();
    await enviar();
    await waitFor(() =>
      expect(screen.getByLabelText(/Teléfono/)).toHaveAccessibleDescription(/entre 7 y 14 dígitos/),
    );
    expect(screen.getByText('Algo más falló')).toBeInTheDocument();
  });

  it('indica la fortaleza de la contraseña mientras se escribe', async () => {
    montar(<FormularioRegistroAdoptante />, () => errorApi(500, 'x'));
    await userEvent.type(screen.getByLabelText(/^Contraseña/, { selector: 'input' }), 'abc');
    const lista = screen.getByRole('list', { name: 'Requisitos de la contraseña' });
    expect(within(lista).getByText(/Una letra mayúscula/)).toHaveTextContent('Falta');
    expect(screen.getByText('Contraseña débil')).toBeInTheDocument();
  });

  it('un 429 es un aviso de espera y conserva lo escrito', async () => {
    montar(<FormularioRegistroAdoptante />, () => errorApi(429, 'Demasiadas solicitudes'));
    await llenar();
    await enviar();
    expect(await screen.findByRole('alert')).toHaveTextContent('demasiados intentos');
    expect(screen.getByLabelText(/Primer nombre/)).toHaveValue('Ana');
  });
});
