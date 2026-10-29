import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { IMailService } from '../mail/mail.interface';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { UsuarioCredenciales } from '../usuarios/usuarios.types';
import { hashSha256 } from './tokens.util';
import {
  ENFRIAMIENTO_REENVIO_MS,
  MENSAJE_REENVIO,
  VerificacionService,
} from './verificacion.service';

const AHORA = new Date('2026-10-29T12:00:00Z');
const HORAS = 24;
const VIGENCIA_MS = HORAS * 3_600_000;

const USUARIO: UsuarioCredenciales = {
  id: 5,
  email: 'ana@example.com',
  contrasenaHash: 'x',
  rol: 'adoptante',
  activo: true,
  emailVerificado: false,
  intentosFallidos: 0,
  bloqueadoHasta: null,
  tokenVerificacionExpira: null,
};

function crear() {
  const usuarios = {
    consumirTokenVerificacion: jest.fn(),
    buscarPorEmail: jest.fn(),
    guardarTokenVerificacion: jest.fn().mockResolvedValue(undefined),
    obtenerPerfil: jest.fn().mockResolvedValue({ adoptante: { primerNombre: 'Ana' } }),
  };
  const mail = { enviar: jest.fn().mockResolvedValue({ enviado: true }) };
  const config = {
    get: (clave: string) =>
      clave === 'FRONTEND_URL'
        ? 'http://localhost:3000/'
        : clave === 'VERIFICACION_EXPIRA_HORAS'
          ? HORAS
          : undefined,
  } as unknown as ConfigService<never, true>;
  const service = new VerificacionService(
    usuarios as unknown as UsuariosService,
    mail as unknown as IMailService,
    config as never,
  );
  return { service, usuarios, mail };
}

describe('VerificacionService', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(AHORA);
  });
  afterEach(() => jest.useRealTimers());

  describe('generarToken / enviarCorreo', () => {
    it('devuelve el token, su SHA-256 y una expiración configurable', () => {
      const { service } = crear();
      const t = service.generarToken(AHORA);
      expect(t.hash).toBe(hashSha256(t.token));
      expect(t.expira.getTime()).toBe(AHORA.getTime() + VIGENCIA_MS);
    });

    it('envía el enlace construido con FRONTEND_URL', async () => {
      const { service, mail } = crear();
      await service.enviarCorreo('ana@example.com', 'Ana', 'a-b_c');
      expect(mail.enviar).toHaveBeenCalledWith({
        para: 'ana@example.com',
        plantilla: 'verificacion-correo',
        datos: {
          nombre: 'Ana',
          enlace: 'http://localhost:3000/verificar-correo?token=a-b_c',
          horasVigencia: 24,
        },
      });
    });
  });

  describe('verificar', () => {
    it('consume el token por su hash y confirma', async () => {
      const { service, usuarios } = crear();
      usuarios.consumirTokenVerificacion.mockResolvedValue(true);
      const r = await service.verificar('token-en-claro');
      expect(usuarios.consumirTokenVerificacion).toHaveBeenCalledWith(
        hashSha256('token-en-claro'),
        AHORA,
      );
      expect(r.mensaje).toContain('verificado');
    });

    it('responde 400 si el token es inválido, vencido o ya usado', async () => {
      const { service, usuarios } = crear();
      usuarios.consumirTokenVerificacion.mockResolvedValue(false);
      await expect(service.verificar('malo')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.verificar('malo')).rejects.toThrow('no es válido o ya venció');
    });
  });

  describe('reenviar', () => {
    const sinEnvio = async (usuario: UsuarioCredenciales | null): Promise<void> => {
      const { service, usuarios, mail } = crear();
      usuarios.buscarPorEmail.mockResolvedValue(usuario);
      const r = await service.reenviar('ana@example.com');
      expect(r.mensaje).toBe(MENSAJE_REENVIO);
      expect(usuarios.guardarTokenVerificacion).not.toHaveBeenCalled();
      expect(mail.enviar).not.toHaveBeenCalled();
    };

    it('responde lo mismo y no envía si el correo no existe', () => sinEnvio(null));
    it('no envía si la cuenta ya está verificada', () =>
      sinEnvio({ ...USUARIO, emailVerificado: true }));
    it('no envía si la cuenta está inactiva', () => sinEnvio({ ...USUARIO, activo: false }));

    it('no envía antes de que pase el tiempo mínimo desde el último envío', () => {
      const ultimoEnvio = AHORA.getTime() - (ENFRIAMIENTO_REENVIO_MS - 1000);
      return sinEnvio({ ...USUARIO, tokenVerificacionExpira: new Date(ultimoEnvio + VIGENCIA_MS) });
    });

    it('envía un token nuevo, guardado solo como hash, pasado el enfriamiento', async () => {
      const { service, usuarios, mail } = crear();
      const ultimoEnvio = AHORA.getTime() - ENFRIAMIENTO_REENVIO_MS;
      usuarios.buscarPorEmail.mockResolvedValue({
        ...USUARIO,
        tokenVerificacionExpira: new Date(ultimoEnvio + VIGENCIA_MS),
      });
      const r = await service.reenviar('ana@example.com');
      await Promise.resolve();

      expect(r.mensaje).toBe(MENSAJE_REENVIO);
      const [id, hash, expira] = usuarios.guardarTokenVerificacion.mock.calls[0];
      expect(id).toBe(5);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(expira.getTime()).toBe(AHORA.getTime() + VIGENCIA_MS);
      const enlace: string = mail.enviar.mock.calls[0][0].datos.enlace;
      expect(hashSha256(new URL(enlace).searchParams.get('token')!)).toBe(hash);
    });

    it('envía si no había token previo (p. ej. venció y se limpió)', async () => {
      const { service, usuarios, mail } = crear();
      usuarios.buscarPorEmail.mockResolvedValue(USUARIO);
      await service.reenviar('ana@example.com');
      await Promise.resolve();
      expect(mail.enviar).toHaveBeenCalledTimes(1);
    });
  });
});
