import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cuerpoJson, errorApi, montar, respuestaJson } from '../prueba-utils';
import { FormularioRecuperacion } from './FormularioRecuperacion';

vi.mock('@/shared/api/http', () =>
  import('../http-prueba').then((m) => ({ http: m.httpSimulado })),
);
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/recuperar',
}));
const aviso = vi.hoisted(() => ({ exito: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('@/shared/ui/Toaster', () => ({ aviso, Toaster: () => null }));

const MENSAJE_CODIGO = 'El código no es válido o ya venció. Solicita uno nuevo.';

beforeEach(() => {
  replace.mockClear();
  aviso.exito.mockClear();
  document.cookie = 'ph_rol=; Path=/; Max-Age=0';
});

async function pedirCodigo(correo = 'Ana@Correo.co') {
  await userEvent.type(screen.getByLabelText(/Correo electrónico/), correo);
  await userEvent.click(screen.getByRole('button', { name: 'Enviar código' }));
}
async function escribirCodigo(codigo: string) {
  await userEvent.type(await screen.findByLabelText(/Código de 6 dígitos/), codigo);
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
}
async function nuevaClave(clave = 'NuevaClave1') {
  await userEvent.type(
    await screen.findByLabelText(/Nueva contraseña/, { selector: 'input' }),
    clave,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
}

describe('FormularioRecuperacion', () => {
  it('flujo completo: correo, código y nueva contraseña; envía todo junto y va a /ingresar', async () => {
    const { llamadas } = montar(<FormularioRecuperacion />, (ruta) =>
      ruta === '/auth/forgot-password' || ruta === '/auth/reset-password'
        ? respuestaJson({ mensaje: 'ok' })
        : errorApi(404, 'x'),
    );
    await pedirCodigo();
    expect(await screen.findByText('Paso 2 de 3: el código')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('ana@correo.co');
    expect(screen.getByRole('status')).toHaveTextContent('vence en pocos minutos');
    // El código solo se revisa por formato: todavía no hay llamada de restablecimiento.
    await escribirCodigo('123456');
    expect(llamadas('/auth/reset-password')).toHaveLength(0);
    await nuevaClave();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/ingresar'));
    expect(cuerpoJson(llamadas('/auth/forgot-password')[0]!)).toEqual({ email: 'ana@correo.co' });
    expect(cuerpoJson(llamadas('/auth/reset-password')[0]!)).toEqual({
      email: 'ana@correo.co',
      codigo: '123456',
      nuevaContrasena: 'NuevaClave1',
    });
    expect(aviso.exito).toHaveBeenCalled();
  });

  it('muestra el mismo paso 2 exista o no la cuenta (el servidor responde igual)', async () => {
    montar(<FormularioRecuperacion />, () => respuestaJson({ mensaje: 'Si el correo existe…' }));
    await pedirCodigo('nadie@x.co');
    expect(await screen.findByText('Paso 2 de 3: el código')).toBeInTheDocument();
  });

  it('el código debe tener 6 dígitos', async () => {
    montar(<FormularioRecuperacion />, () => respuestaJson({ mensaje: 'ok' }));
    await pedirCodigo();
    await escribirCodigo('12a');
    expect(await screen.findByText('El código debe tener 6 dígitos')).toBeInTheDocument();
    expect(screen.getByText('Paso 2 de 3: el código')).toBeInTheDocument();
  });

  it('un código rechazado vuelve al paso 2 con el error y el correo intacto', async () => {
    const { llamadas } = montar(<FormularioRecuperacion />, (ruta) =>
      ruta === '/auth/reset-password'
        ? errorApi(400, MENSAJE_CODIGO)
        : respuestaJson({ mensaje: 'ok' }),
    );
    await pedirCodigo();
    await escribirCodigo('000000');
    await nuevaClave();
    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAJE_CODIGO);
    expect(screen.getByText('Paso 2 de 3: el código')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('ana@correo.co');
    expect(replace).not.toHaveBeenCalled();

    // «Pedir otro código» vuelve a llamar a forgot-password con el mismo correo.
    await userEvent.click(screen.getByRole('button', { name: 'Pedir otro código' }));
    await waitFor(() => expect(llamadas('/auth/forgot-password')).toHaveLength(2));
    expect(cuerpoJson(llamadas('/auth/forgot-password')[1]!)).toEqual({ email: 'ana@correo.co' });
    expect(
      screen.getByRole('button', { name: /Pedir otro código \(espera \d+ s\)/ }),
    ).toBeDisabled();
  });

  it('una contraseña rechazada por el servidor se muestra en el campo, sin perder el código', async () => {
    montar(<FormularioRecuperacion />, (ruta) =>
      ruta === '/auth/reset-password'
        ? errorApi(400, 'Los datos enviados no son válidos', [
            {
              campo: 'nuevaContrasena',
              mensajes: ['La contraseña debe incluir al menos un número'],
            },
          ])
        : respuestaJson({ mensaje: 'ok' }),
    );
    await pedirCodigo();
    await escribirCodigo('123456');
    await nuevaClave('NuevaClave1');
    expect(
      await screen.findByText('La contraseña debe incluir al menos un número'),
    ).toBeInTheDocument();
    expect(screen.getByText('Paso 3 de 3: tu nueva contraseña')).toBeInTheDocument();
  });

  it('la contraseña nueva se valida con la política antes de enviar', async () => {
    const { llamadas } = montar(<FormularioRecuperacion />, () => respuestaJson({ mensaje: 'ok' }));
    await pedirCodigo();
    await escribirCodigo('123456');
    await nuevaClave('corta');
    expect(
      await screen.findByText('La contraseña debe tener entre 8 y 64 caracteres'),
    ).toBeInTheDocument();
    expect(llamadas('/auth/reset-password')).toHaveLength(0);
  });

  it('un 429 al pedir el código es un mensaje de espera y conserva el paso 1', async () => {
    montar(<FormularioRecuperacion />, () => errorApi(429, 'Demasiadas solicitudes'));
    await pedirCodigo();
    expect(await screen.findByRole('alert')).toHaveTextContent('demasiados intentos');
    expect(screen.getByLabelText(/Correo electrónico/)).toHaveValue('Ana@Correo.co');
  });

  it('permite usar otro correo desde el paso 2', async () => {
    montar(<FormularioRecuperacion />, () => respuestaJson({ mensaje: 'ok' }));
    await pedirCodigo();
    await userEvent.click(await screen.findByRole('button', { name: 'Usar otro correo' }));
    expect(screen.getByText('Paso 1 de 3: tu correo')).toBeInTheDocument();
  });
});
