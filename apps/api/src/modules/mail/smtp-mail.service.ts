import { Logger } from '@nestjs/common';
import type { Transporter } from 'nodemailer';
import type { IMailService, MensajeCorreo, ResultadoEnvio } from './mail.interface';
import { renderizar } from './plantillas/plantillas';

export type MailTransport = Pick<Transporter, 'sendMail'>;

export class SmtpMailService implements IMailService {
  private readonly logger = new Logger(SmtpMailService.name);

  constructor(
    private readonly transporte: MailTransport,
    private readonly remitente: string,
  ) {}

  async enviar(mensaje: MensajeCorreo): Promise<ResultadoEnvio> {
    try {
      const { asunto, texto, html } = renderizar(mensaje.plantilla, mensaje.datos as never);
      await this.transporte.sendMail({
        from: this.remitente,
        to: mensaje.para,
        subject: asunto,
        text: texto,
        html,
      });
      return { enviado: true };
    } catch (error) {
      // Sin cuerpo ni destinatario en el log: solo la plantilla y la causa.
      const causa = error instanceof Error ? error.message : String(error);
      this.logger.error(`No se pudo enviar el correo (plantilla ${mensaje.plantilla}): ${causa}`);
      return { enviado: false, error: causa };
    }
  }
}
