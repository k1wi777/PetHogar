import { describe, expect, it, vi } from 'vitest';
import { crearClienteHttp, type FetchImpl } from '@/shared/api/cliente';
import {
  registrarAdoptante,
  registrarFundacion,
  reenviarVerificacion,
  restablecerContrasena,
  solicitarCodigo,
  verificarCorreo,
} from './autenticacion';

function montar() {
  const fetchImpl = vi.fn<FetchImpl>(
    async () =>
      new Response(JSON.stringify({ mensaje: 'ok' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  const cliente = crearClienteHttp({ baseUrl: 'http://api.test/api', fetchImpl, cerrojos: null });
  return { fetchImpl, cliente };
}

describe('capa de API de autenticación', () => {
  it('el registro de adoptante omite los opcionales vacíos y no envía token', async () => {
    const { fetchImpl, cliente } = montar();
    await registrarAdoptante(
      {
        primerNombre: 'Ana',
        segundoNombre: '',
        primerApellido: 'Pérez',
        tipoDocumento: 'CC',
        numeroDocumento: 'ABC1234',
        fechaNacimiento: '1990-05-10',
        telefono: '3001234567',
        email: 'a@b.co',
        direccion: 'Calle 1',
        ciudad: 'Montería',
        contrasena: 'Clave1234',
        aceptaPoliticaDatos: true,
      },
      cliente,
    );
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('http://api.test/api/auth/register/adoptante');
    const cuerpo = JSON.parse(init!.body as string);
    expect(cuerpo).not.toHaveProperty('segundoNombre');
    expect(cuerpo.aceptaPoliticaDatos).toBe(true);
    expect((init!.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('el registro de fundación es multipart con el archivo en «documento»', async () => {
    const { fetchImpl, cliente } = montar();
    const documento = new File(['%PDF'], 'legal.pdf', { type: 'application/pdf' });
    await registrarFundacion(
      {
        nombre: 'Patitas',
        nit: '900123456-7',
        direccion: 'Calle 1',
        ciudad: 'Montería',
        descripcion: '',
        telefono: '3001234567',
        email: 'f@x.co',
        contrasena: 'Clave1234',
        documento,
        aceptaPoliticaDatos: true,
      },
      cliente,
    );
    const [, init] = fetchImpl.mock.calls[0]!;
    const cuerpo = init!.body as FormData;
    expect(cuerpo).toBeInstanceOf(FormData);
    expect(cuerpo.get('nombre')).toBe('Patitas');
    expect(cuerpo.get('aceptaPoliticaDatos')).toBe('true');
    expect(cuerpo.has('descripcion')).toBe(false);
    expect((cuerpo.get('documento') as File).name).toBe('legal.pdf');
    expect((init!.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('verificación, reenvío y recuperación usan las rutas del backend', async () => {
    const { fetchImpl, cliente } = montar();
    await verificarCorreo('tok en', cliente);
    await reenviarVerificacion('a@b.co', cliente);
    await solicitarCodigo('a@b.co', cliente);
    await restablecerContrasena(
      { email: 'a@b.co', codigo: '123456', nuevaContrasena: 'Clave1234' },
      cliente,
    );
    expect(fetchImpl.mock.calls.map((c) => c[0])).toEqual([
      'http://api.test/api/auth/verify-email?token=tok+en',
      'http://api.test/api/auth/verify-email/resend',
      'http://api.test/api/auth/forgot-password',
      'http://api.test/api/auth/reset-password',
    ]);
    expect(JSON.parse(fetchImpl.mock.calls[3]![1]!.body as string)).toEqual({
      email: 'a@b.co',
      codigo: '123456',
      nuevaContrasena: 'Clave1234',
    });
  });
});
