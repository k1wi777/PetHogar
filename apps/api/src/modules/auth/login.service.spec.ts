import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { UsuarioCredenciales } from '../usuarios/usuarios.types';
import { LoginService, MENSAJE_CREDENCIALES } from './login.service';
import type { SesionService } from './sesion.service';

const AHORA = new Date('2026-10-29T12:00:00Z');
const MAX = 5;
const BLOQUEO_MIN = 15;
const CLAVE = 'Clave1234';
let hash: string;

const base = (): UsuarioCredenciales => ({
  id: 5,
  email: 'ana@example.com',
  contrasenaHash: hash,
  rol: 'adoptante',
  activo: true,
  emailVerificado: true,
  intentosFallidos: 0,
  bloqueadoHasta: null,
  tokenVerificacionExpira: null,
});

function crear(usuario: UsuarioCredenciales | null) {
  const usuarios = {
    buscarPorEmail: jest.fn().mockResolvedValue(usuario),
    registrarIntentoFallido: jest.fn().mockResolvedValue(undefined),
    reiniciarIntentos: jest.fn().mockResolvedValue(undefined),
  };
  const sesion = { abrir: jest.fn().mockResolvedValue({ respuesta: { accessToken: 'jwt' } }) };
  const config = {
    get: (c: string) => ({ LOGIN_MAX_INTENTOS: MAX, LOGIN_BLOQUEO_MIN: BLOQUEO_MIN })[c],
  };
  const service = new LoginService(
    usuarios as unknown as UsuariosService,
    sesion as unknown as SesionService,
    config as never,
  );
  return { service, usuarios, sesion };
}

describe('LoginService', () => {
  beforeAll(async () => {
    hash = await bcrypt.hash(CLAVE, 4);
  });
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(AHORA);
  });
  afterEach(() => jest.useRealTimers());

  it('con credenciales correctas abre sesión con id y rol, sin reiniciar nada si no hay intentos', async () => {
    const { service, usuarios, sesion } = crear(base());
    await service.iniciarSesion({ email: 'ana@example.com', contrasena: CLAVE });
    expect(sesion.abrir).toHaveBeenCalledWith({ id: 5, rol: 'adoptante' }, AHORA);
    expect(usuarios.reiniciarIntentos).not.toHaveBeenCalled();
    expect(usuarios.registrarIntentoFallido).not.toHaveBeenCalled();
  });

  it('un inicio correcto reinicia el contador de intentos fallidos', async () => {
    const { service, usuarios } = crear({ ...base(), intentosFallidos: 3 });
    await service.iniciarSesion({ email: 'ana@example.com', contrasena: CLAVE });
    expect(usuarios.reiniciarIntentos).toHaveBeenCalledWith(5);
  });

  it('contraseña incorrecta: 401 genérico y suma un intento con los límites configurados', async () => {
    const { service, usuarios, sesion } = crear(base());
    const error = await service
      .iniciarSesion({ email: 'ana@example.com', contrasena: 'Equivocada1' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnauthorizedException);
    expect((error as UnauthorizedException).message).toBe(MENSAJE_CREDENCIALES);
    expect(usuarios.registrarIntentoFallido).toHaveBeenCalledWith(
      5,
      MAX,
      BLOQUEO_MIN * 60_000,
      AHORA,
    );
    expect(sesion.abrir).not.toHaveBeenCalled();
  });

  it('correo inexistente: el mismo 401 genérico y sin contadores', async () => {
    const { service, usuarios } = crear(null);
    const error = await service
      .iniciarSesion({ email: 'nadie@example.com', contrasena: CLAVE })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnauthorizedException);
    expect((error as UnauthorizedException).message).toBe(MENSAJE_CREDENCIALES);
    expect(usuarios.registrarIntentoFallido).not.toHaveBeenCalled();
  });

  it('con la cuenta bloqueada rechaza incluso con la contraseña correcta, indicando los minutos', async () => {
    const bloqueadoHasta = new Date(AHORA.getTime() + 10 * 60_000 + 1);
    const { service, usuarios, sesion } = crear({ ...base(), intentosFallidos: 5, bloqueadoHasta });
    const error = await service
      .iniciarSesion({ email: 'ana@example.com', contrasena: CLAVE })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).message).toContain('en 11 minutos');
    expect(usuarios.registrarIntentoFallido).not.toHaveBeenCalled();
    expect(sesion.abrir).not.toHaveBeenCalled();
  });

  it('el bloqueo se levanta por tiempo: pasado el plazo permite iniciar sesión y reinicia el contador', async () => {
    const bloqueadoHasta = new Date(AHORA.getTime() + 60_000);
    const { service, usuarios, sesion } = crear({ ...base(), intentosFallidos: 5, bloqueadoHasta });
    await expect(
      service.iniciarSesion({ email: 'ana@example.com', contrasena: CLAVE }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    jest.setSystemTime(new Date(bloqueadoHasta.getTime() + 1));
    await service.iniciarSesion({ email: 'ana@example.com', contrasena: CLAVE });
    expect(sesion.abrir).toHaveBeenCalledTimes(1);
    expect(usuarios.reiniciarIntentos).toHaveBeenCalledWith(5);
  });

  it('cuenta inactiva con contraseña correcta: 403 con mensaje específico', async () => {
    const { service, sesion } = crear({ ...base(), activo: false });
    await expect(
      service.iniciarSesion({ email: 'ana@example.com', contrasena: CLAVE }),
    ).rejects.toThrow('desactivada');
    expect(sesion.abrir).not.toHaveBeenCalled();
  });

  it('cuenta sin verificar con contraseña correcta: 403 con mensaje específico', async () => {
    const { service, sesion } = crear({ ...base(), emailVerificado: false });
    await expect(
      service.iniciarSesion({ email: 'ana@example.com', contrasena: CLAVE }),
    ).rejects.toThrow('verificar tu correo');
    expect(sesion.abrir).not.toHaveBeenCalled();
  });

  it('con contraseña errónea no revela que la cuenta está inactiva o sin verificar', async () => {
    const { service } = crear({ ...base(), activo: false, emailVerificado: false });
    await expect(
      service.iniciarSesion({ email: 'ana@example.com', contrasena: 'Equivocada1' }),
    ).rejects.toThrow(MENSAJE_CREDENCIALES);
  });
});
