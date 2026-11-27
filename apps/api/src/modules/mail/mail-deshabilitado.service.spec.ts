import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation';
import { MailDeshabilitadoService } from './mail-deshabilitado.service';
import { ADVERTENCIA_SIN_VERIFICACION, crearServicioCorreo } from './mail.module';
import { SmtpMailService, type MailTransport } from './smtp-mail.service';

const MENSAJE = {
  para: 'ana@example.com',
  plantilla: 'verificacion-correo',
  datos: { nombre: 'Ana', enlace: 'http://localhost/?token=secreto', horasVigencia: 24 },
} as const;

function configurar(env: Record<string, string>) {
  const transporte = { sendMail: jest.fn().mockResolvedValue({}) };
  const config = {
    get: (clave: string) => env[clave],
  } as unknown as ConfigService<EnvironmentVariables, true>;
  const servicio = crearServicioCorreo(transporte as unknown as MailTransport, config);
  return { servicio, transporte };
}

describe('correo deshabilitado', () => {
  let advertir: jest.SpyInstance;
  let depurar: jest.SpyInstance;
  let fallar: jest.SpyInstance;

  beforeEach(() => {
    advertir = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    depurar = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    fallar = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([{}, { CORREO_HABILITADO: 'true' }] as Record<string, string>[])(
    'con %p envía por SMTP como siempre y no advierte',
    async (env) => {
      const { servicio, transporte } = configurar({ ...env, SMTP_FROM: 'a@pethogar.local' });
      expect(servicio).toBeInstanceOf(SmtpMailService);
      await expect(servicio.enviar(MENSAJE)).resolves.toEqual({ enviado: true });
      expect(transporte.sendMail).toHaveBeenCalledTimes(1);
      expect(advertir).not.toHaveBeenCalled();
    },
  );

  it('deshabilitado resuelve sin usar el transporte y sin registrar destinatario ni contenido', async () => {
    const { servicio, transporte } = configurar({
      CORREO_HABILITADO: 'false',
      VERIFICACION_AUTOMATICA: 'true',
    });
    expect(servicio).toBeInstanceOf(MailDeshabilitadoService);
    await expect(servicio.enviar(MENSAJE)).resolves.toEqual({
      enviado: false,
      error: 'correo deshabilitado',
    });
    expect(transporte.sendMail).not.toHaveBeenCalled();
    expect(fallar).not.toHaveBeenCalled();
    const registro = JSON.stringify(depurar.mock.calls);
    expect(registro).toContain('verificacion-correo');
    expect(registro).not.toMatch(/ana@example\.com|Ana|secreto/);
    expect(advertir).not.toHaveBeenCalled();
  });

  it.each([{}, { VERIFICACION_AUTOMATICA: 'false' }] as Record<string, string>[])(
    'advierte una vez al arrancar si además no hay verificación automática (%p)',
    async (env) => {
      const { servicio } = configurar({ ...env, CORREO_HABILITADO: 'false' });
      await servicio.enviar(MENSAJE);
      expect(advertir).toHaveBeenCalledTimes(1);
      expect(advertir).toHaveBeenCalledWith(ADVERTENCIA_SIN_VERIFICACION);
    },
  );
});
