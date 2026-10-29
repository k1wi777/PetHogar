import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation';
import { IMailService, MAIL_SERVICE } from '../mail/mail.interface';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { Aviso } from './textos-aviso';

/** Ruta provisional del front para las notificaciones (F-24); si cambia, se ajusta aquí. */
export const RUTA_NOTIFICACIONES = '/notificaciones';
const NOMBRE_POR_DEFECTO = 'usuario de PetHogar';

/** Correo que acompaña a un aviso: la plantilla genérica o la confirmación de donación. */
export type CorreoAviso =
  | { plantilla: 'notificacion' }
  | {
      plantilla: 'donacion-confirmacion';
      fundacion: string;
      detalle: string;
      fecha: string;
    };

export interface OpcionesEntrega {
  correo?: CorreoAviso;
  /** Nombre para el saludo del correo; por defecto el del contacto. */
  nombre?: string;
}

/**
 * Entrega un aviso a UN destinatario: contacto activo → notificación → correo. Cada efecto está
 * aislado (uno que falla no impide el siguiente) y este método nunca lanza: lo único que no hace es
 * enviar correo cuando la notificación ya existía (la misma clave deduplica ambos).
 */
@Injectable()
export class EntregaAvisoService {
  private readonly logger = new Logger(EntregaAvisoService.name);

  constructor(
    private readonly usuarios: UsuariosService,
    private readonly notificaciones: NotificacionesService,
    @Inject(MAIL_SERVICE) private readonly mail: IMailService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async entregar(usuarioId: number, aviso: Aviso, opciones: OpcionesEntrega = {}): Promise<void> {
    try {
      // Una cuenta desactivada no recibe notificaciones ni correos.
      const contacto = await this.usuarios.contactoActivo(usuarioId);
      if (!contacto) return;

      const creada = await this.crearNotificacion(usuarioId, aviso);
      // Un duplicado (misma clave) no reenvía el correo; si la creación falló, se intenta igual.
      if (opciones.correo && creada !== false) {
        await this.enviarCorreo(contacto.email, contacto.nombre, aviso, opciones);
      }
    } catch (error) {
      this.logger.error(
        `No se pudo entregar el aviso ${aviso.clave} al usuario ${usuarioId}: ${mensajeDe(error)}`,
      );
    }
  }

  /** `undefined` si la creación falló (ya registrado), para que el correo se intente igual. */
  private async crearNotificacion(usuarioId: number, aviso: Aviso): Promise<boolean | undefined> {
    try {
      const { creada } = await this.notificaciones.crear({ usuarioId, ...aviso });
      return creada;
    } catch (error) {
      this.logger.error(
        `No se pudo crear la notificación ${aviso.clave} del usuario ${usuarioId}: ${mensajeDe(error)}`,
      );
      return undefined;
    }
  }

  private async enviarCorreo(
    para: string,
    nombreContacto: string | null,
    aviso: Aviso,
    opciones: OpcionesEntrega,
  ): Promise<void> {
    const correo = opciones.correo;
    if (!correo) return;
    const nombre = opciones.nombre ?? nombreContacto ?? NOMBRE_POR_DEFECTO;
    try {
      const resultado =
        correo.plantilla === 'donacion-confirmacion'
          ? await this.mail.enviar({
              para,
              plantilla: 'donacion-confirmacion',
              datos: {
                nombre,
                fundacion: correo.fundacion,
                detalle: correo.detalle,
                fecha: correo.fecha,
              },
            })
          : await this.mail.enviar({
              para,
              plantilla: 'notificacion',
              datos: {
                nombre,
                titulo: aviso.titulo,
                mensaje: aviso.mensaje,
                enlace: this.enlace(),
              },
            });
      if (!resultado.enviado) {
        this.logger.error(
          `No se envió el correo del aviso ${aviso.clave}: ${resultado.error ?? ''}`,
        );
      }
    } catch (error) {
      this.logger.error(`Falló el envío del correo del aviso ${aviso.clave}: ${mensajeDe(error)}`);
    }
  }

  private enlace(): string {
    const base = this.config.get('FRONTEND_URL', { infer: true }).replace(/\/+$/, '');
    return `${base}${RUTA_NOTIFICACIONES}`;
  }
}

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : 'error desconocido';
}
