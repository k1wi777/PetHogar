import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import {
  correoHabilitado,
  esVerdadero,
  type EnvironmentVariables,
} from '../../config/env.validation';
import { MailDeshabilitadoService } from './mail-deshabilitado.service';
import { MAIL_SERVICE, type IMailService } from './mail.interface';
import { SmtpMailService, type MailTransport } from './smtp-mail.service';

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');

const TIEMPO_LIMITE_MS = 5000;

export const ADVERTENCIA_SIN_VERIFICACION =
  'El correo está deshabilitado y la verificación automática no está activada: los adoptantes ' +
  'nuevos no podrán verificar su cuenta (define VERIFICACION_AUTOMATICA=true).';

/** Elige la implementación según `CORREO_HABILITADO`; la factoría se ejecuta una sola vez. */
export function crearServicioCorreo(
  transporte: MailTransport,
  config: ConfigService<EnvironmentVariables, true>,
): IMailService {
  if (correoHabilitado(config.get('CORREO_HABILITADO', { infer: true }))) {
    return new SmtpMailService(transporte, config.get('SMTP_FROM', { infer: true }));
  }
  if (!esVerdadero(config.get('VERIFICACION_AUTOMATICA', { infer: true }))) {
    new Logger(MailModule.name).warn(ADVERTENCIA_SIN_VERIFICACION);
  }
  return new MailDeshabilitadoService();
}

/** Para cambiar de proveedor basta otra clase en MAIL_SERVICE; el dominio solo usa la interfaz. */
@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>): MailTransport => {
        const usuario = config.get('SMTP_USER', { infer: true });
        return createTransport({
          host: config.get('SMTP_HOST', { infer: true }),
          port: config.get('SMTP_PORT', { infer: true }),
          secure: esVerdadero(config.get('SMTP_SECURE', { infer: true })),
          auth: usuario
            ? { user: usuario, pass: config.get('SMTP_PASSWORD', { infer: true }) ?? '' }
            : undefined,
          connectionTimeout: TIEMPO_LIMITE_MS,
          greetingTimeout: TIEMPO_LIMITE_MS,
          socketTimeout: TIEMPO_LIMITE_MS,
        });
      },
    },
    {
      provide: MAIL_SERVICE,
      inject: [MAIL_TRANSPORT, ConfigService],
      useFactory: crearServicioCorreo,
    },
  ],
  exports: [MAIL_SERVICE],
})
export class MailModule {}
