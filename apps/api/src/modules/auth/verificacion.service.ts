import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation';
import { IMailService, MAIL_SERVICE } from '../mail/mail.interface';
import { UsuariosService } from '../usuarios/usuarios.service';
import { generarTokenOpaco, hashSha256 } from './tokens.util';

/** Tiempo mínimo entre dos envíos de verificación a la misma cuenta. */
export const ENFRIAMIENTO_REENVIO_MS = 2 * 60 * 1000;
const HORA_MS = 60 * 60 * 1000;

export const MENSAJE_TOKEN_INVALIDO =
  'El enlace de verificación no es válido o ya venció. Solicita uno nuevo.';
/** Mismo texto exista o no la cuenta, para no revelar qué correos están registrados. */
export const MENSAJE_REENVIO =
  'Si el correo corresponde a una cuenta pendiente de verificar, te enviaremos un nuevo enlace.';
export const MENSAJE_CORREO_VERIFICADO = 'Tu correo fue verificado. Ya puedes iniciar sesión.';

export interface TokenVerificacion {
  token: string;
  hash: string;
  expira: Date;
}

@Injectable()
export class VerificacionService {
  constructor(
    private readonly usuarios: UsuariosService,
    @Inject(MAIL_SERVICE) private readonly mail: IMailService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  /** El token en claro solo existe para el correo; en BD van su hash y la expiración. */
  generarToken(ahora: Date): TokenVerificacion {
    const token = generarTokenOpaco();
    return {
      token,
      hash: hashSha256(token),
      expira: new Date(ahora.getTime() + this.vigenciaMs()),
    };
  }

  /** `IMailService.enviar` nunca lanza: un fallo queda en el log y el usuario puede pedir reenvío. */
  async enviarCorreo(email: string, nombre: string, token: string): Promise<void> {
    const base = this.config.get('FRONTEND_URL', { infer: true }).replace(/\/+$/, '');
    await this.mail.enviar({
      para: email,
      plantilla: 'verificacion-correo',
      datos: {
        nombre,
        enlace: `${base}/verificar-correo?token=${encodeURIComponent(token)}`,
        horasVigencia: this.config.get('VERIFICACION_EXPIRA_HORAS', { infer: true }),
      },
    });
  }

  async verificar(token: string): Promise<{ mensaje: string }> {
    const consumido = await this.usuarios.consumirTokenVerificacion(hashSha256(token), new Date());
    if (!consumido) throw new BadRequestException(MENSAJE_TOKEN_INVALIDO);
    return { mensaje: MENSAJE_CORREO_VERIFICADO };
  }

  async reenviar(email: string): Promise<{ mensaje: string }> {
    const ahora = new Date();
    const usuario = await this.usuarios.buscarPorEmail(email);
    if (
      usuario &&
      usuario.activo &&
      !usuario.emailVerificado &&
      this.puedeReenviar(usuario.tokenVerificacionExpira, ahora)
    ) {
      const nuevo = this.generarToken(ahora);
      await this.usuarios.guardarTokenVerificacion(usuario.id, nuevo.hash, nuevo.expira);
      const perfil = await this.usuarios.obtenerPerfil(usuario.id);
      // Sin await: el tiempo de respuesta no debe delatar si la cuenta existe.
      void this.enviarCorreo(
        usuario.email,
        perfil?.adoptante?.primerNombre ?? 'usuario',
        nuevo.token,
      );
    }
    return { mensaje: MENSAJE_REENVIO };
  }

  /** El último envío se deduce de `expira − vigencia`, sin columna adicional. */
  private puedeReenviar(expira: Date | null, ahora: Date): boolean {
    if (!expira) return true;
    const ultimoEnvio = expira.getTime() - this.vigenciaMs();
    return ahora.getTime() - ultimoEnvio >= ENFRIAMIENTO_REENVIO_MS;
  }

  private vigenciaMs(): number {
    return this.config.get('VERIFICACION_EXPIRA_HORAS', { infer: true }) * HORA_MS;
  }
}
