import { Logger } from '@nestjs/common';
import type { IMailService, MensajeCorreo, ResultadoEnvio } from './mail.interface';

export const CAUSA_CORREO_DESHABILITADO = 'correo deshabilitado';

/** Sin red ni espera: para entornos sin servidor SMTP (`CORREO_HABILITADO=false`). */
export class MailDeshabilitadoService implements IMailService {
  private readonly logger = new Logger(MailDeshabilitadoService.name);

  enviar(mensaje: MensajeCorreo): Promise<ResultadoEnvio> {
    // Sin cuerpo ni destinatario en el log: solo la plantilla.
    this.logger.debug(`Correo no enviado (plantilla ${mensaje.plantilla}): deshabilitado`);
    return Promise.resolve({ enviado: false, error: CAUSA_CORREO_DESHABILITADO });
  }
}
