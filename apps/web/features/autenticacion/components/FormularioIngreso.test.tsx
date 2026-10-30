import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MENSAJES } from '@/shared/api/errores';
import { MENSAJE_LIMITE } from '../lib/errores-servidor';
import { cuerpoJson, errorApi, montar, respuestaJson, usuarioDe } from '../prueba-utils';
import { FormularioIngreso } from './FormularioIngreso';

vi.mock('@/shared/api/http', () =>
  import('../http-prueba').then((m) => ({ http: m.httpSimulado })),
);
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/ingresar',
}));
const aviso = vi.hoisted(() => ({ exito: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('@/shared/ui/Toaster', () => ({ aviso, Toaster: () => null }));

const sesion = (usuario = usuarioDe('adoptante')) => ({
  accessToken: 'tok',
  expiresIn: 900,
  usuario,
});

async function escribir(correo = 'Ana@Correo.co', clave = 'Secreta1') {
  await userEvent.type(screen.getByLabelText(/Correo electrónico/), correo);
  await userEvent.type(screen.getByLabelText(/Contraseña/, { selector: 'input' }), clave);
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
}

beforeEach(() => {
  replace.mockClear();
  aviso.info.mockClear();
  document.cookie = 'ph_rol=; Path=/; Max-Age=0';
});

describe('FormularioIngreso', () => {
  it('inicia sesión con el correo normalizado y lleva al panel del rol', async () => {
    const { llamadas } = montar(<FormularioIngreso />, (ruta) =>
      ruta === '/auth/login' ? respuestaJson(sesion()) : errorApi(404, 'x'),
    );
    await escribir();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/adoptante'));
    expect(cuerpoJson(llamadas('/auth/login')[0]!)).toEqual({
      email: 'ana@correo.co',
      contrasena: 'Secreta1',
    });
  });

  it('respeta un destino «siguiente» interno y descarta uno externo', async () => {
    const login = (ruta: string) =>
      ruta === '/auth/login' ? respuestaJson(sesion()) : errorApi(404, 'x');
    const primero = montar(<FormularioIngreso siguiente="/adoptante/solicitudes" />, login);
    await escribir();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/adoptante/solicitudes'));
    primero.unmount();

    replace.mockClear();
    montar(<FormularioIngreso siguiente="//evil.com" />, login);
    await escribir();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/adoptante'));
  });

  it('credenciales incorrectas: mensaje del servidor, correo conservado y contraseña vacía', async () => {
    montar(<FormularioIngreso />, () => errorApi(401, 'Correo o contraseña incorrectos'));
    await escribir();
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos');
    expect(screen.getByLabelText(/Correo electrónico/)).toHaveValue('Ana@Correo.co');
    expect(screen.getByLabelText(/Contraseña/, { selector: 'input' })).toHaveValue('');
    expect(replace).not.toHaveBeenCalled();
  });

  it('cuenta bloqueada: muestra el tiempo restante que entrega la API', async () => {
    montar(<FormularioIngreso />, () =>
      errorApi(
        403,
        'Cuenta bloqueada temporalmente por demasiados intentos fallidos. Intenta de nuevo en 12 minutos.',
      ),
    );
    await escribir();
    expect(await screen.findByRole('alert')).toHaveTextContent('Intenta de nuevo en 12 minutos.');
    expect(screen.queryByRole('button', { name: /Reenviar/ })).not.toBeInTheDocument();
  });

  it('cuenta desactivada: indica contactar a un administrador', async () => {
    montar(<FormularioIngreso />, () =>
      errorApi(403, 'Tu cuenta está desactivada. Comunícate con un administrador de PetHogar.'),
    );
    await escribir();
    expect(await screen.findByRole('alert')).toHaveTextContent('Comunícate con un administrador');
  });

  it('correo sin verificar: ofrece reenviar el enlace y lo envía al correo escrito', async () => {
    const { llamadas } = montar(<FormularioIngreso />, (ruta) =>
      ruta === '/auth/verify-email/resend'
        ? respuestaJson({
            mensaje: 'Si el correo corresponde a una cuenta pendiente, te enviaremos un enlace.',
          })
        : errorApi(
            403,
            'Debes verificar tu correo antes de iniciar sesión. Revisa tu bandeja o solicita un nuevo enlace.',
          ),
    );
    await escribir();
    const boton = await screen.findByRole('button', { name: 'Reenviar enlace de verificación' });
    await userEvent.click(boton);
    expect(await screen.findByRole('status')).toHaveTextContent('te enviaremos un enlace');
    expect(cuerpoJson(llamadas('/auth/verify-email/resend')[0]!)).toEqual({
      email: 'ana@correo.co',
    });
    expect(screen.getByRole('button', { name: /Reenviar enlace \(espera \d+ s\)/ })).toBeDisabled();
  });

  it('fundación pendiente: avisa su estado y la lleva igualmente a su panel', async () => {
    const usuario = usuarioDe('fundacion', {
      id: 1,
      nombre: 'Patitas',
      estadoValidacion: 'pendiente',
      observacionValidacion: null,
    });
    montar(<FormularioIngreso />, () => respuestaJson(sesion(usuario)));
    await escribir();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/fundacion'));
    expect(aviso.info).toHaveBeenCalledWith(expect.stringContaining('pendiente de validación'));
  });

  it('fundación rechazada: incluye la observación del administrador como texto', async () => {
    const usuario = usuarioDe('fundacion', {
      id: 1,
      nombre: 'Patitas',
      estadoValidacion: 'rechazada',
      observacionValidacion: 'Falta el <b>RUT</b> vigente',
    });
    montar(<FormularioIngreso />, () => respuestaJson(sesion(usuario)));
    await escribir();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/fundacion'));
    expect(aviso.info).toHaveBeenCalledWith(
      'Tu fundación fue rechazada. Observación del administrador: Falta el <b>RUT</b> vigente',
    );
  });

  it('fundación aprobada: sin aviso', async () => {
    const usuario = usuarioDe('fundacion', {
      id: 1,
      nombre: 'Patitas',
      estadoValidacion: 'aprobada',
      observacionValidacion: null,
    });
    montar(<FormularioIngreso />, () => respuestaJson(sesion(usuario)));
    await escribir();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/fundacion'));
    expect(aviso.info).not.toHaveBeenCalled();
  });

  it('un 429 es un mensaje de espera, no un error de credenciales', async () => {
    montar(<FormularioIngreso />, () => errorApi(429, 'Demasiadas solicitudes'));
    await escribir();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(MENSAJE_LIMITE);
    expect(alerta).not.toHaveTextContent('incorrectos');
  });

  it('un fallo de red da un mensaje de reintento y conserva el correo', async () => {
    montar(<FormularioIngreso />, () => {
      throw new TypeError('fallo');
    });
    await escribir();
    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAJES.red);
    expect(screen.getByLabelText(/Correo electrónico/)).toHaveValue('Ana@Correo.co');
  });

  it('valida en el cliente sin llamar al servidor', async () => {
    const { llamadas } = montar(<FormularioIngreso />, () => errorApi(500, 'x'));
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByText('Ingresa un correo electrónico válido')).toBeInTheDocument();
    expect(screen.getByText('Ingresa tu contraseña')).toBeInTheDocument();
    expect(llamadas('/auth/login')).toHaveLength(0);
  });

  it('deshabilita el envío mientras la petición está en curso (un solo POST)', async () => {
    let liberar!: () => void;
    const { llamadas } = montar(<FormularioIngreso />, (ruta) =>
      ruta === '/auth/login'
        ? new Promise<Response>((resolver) => {
            liberar = () => resolver(respuestaJson(sesion()));
          })
        : errorApi(404, 'x'),
    );
    await escribir();
    const boton = screen.getByRole('button', { name: 'Ingresar' });
    await waitFor(() => expect(boton).toBeDisabled());
    expect(boton).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(boton);
    expect(llamadas('/auth/login')).toHaveLength(1);
    liberar();
    await waitFor(() => expect(replace).toHaveBeenCalled());
  });

  it('enlaza a recuperación y a los dos registros', () => {
    montar(<FormularioIngreso />, () => errorApi(404, 'x'));
    expect(screen.getByRole('link', { name: 'Olvidé mi contraseña' })).toHaveAttribute(
      'href',
      '/recuperar',
    );
    expect(screen.getByRole('link', { name: /Regístrate como adoptante/ })).toHaveAttribute(
      'href',
      '/registro',
    );
    expect(screen.getByRole('link', { name: /registra tu fundación/ })).toHaveAttribute(
      'href',
      '/registro-fundacion',
    );
  });
});
