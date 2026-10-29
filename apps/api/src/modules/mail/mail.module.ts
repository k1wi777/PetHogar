import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { esVerdadero, type EnvironmentVariables } from '../../config/env.validation';
import { MAIL_SERVICE } from './mail.interface';
import { SmtpMailService, type MailTransport } from './smtp-mail.service';

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');

const TIEMPO_LIMITE_MS = 5000;

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
      useFactory: (transporte: MailTransport, config: ConfigService<EnvironmentVariables, true>) =>
        new SmtpMailService(transporte, config.get('SMTP_FROM', { infer: true })),
    },
  ],
  exports: [MAIL_SERVICE],
})
export class MailModule {}
