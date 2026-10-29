import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { EnvironmentVariables } from '../../config/env.validation';
import { FundacionesService } from '../fundaciones/fundaciones.service';
import { IMailService, MAIL_SERVICE } from '../mail/mail.interface';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { UsuarioCredenciales } from '../usuarios/usuarios.types';
import { generarCodigo, hashearCodigo, hashesIguales } from './codigo-recuperacion';
import { hashearContrasena } from './contrasena';
import type { RestablecerContrasenaDto } from './dto/recuperacion.dto';
import { SesionService } from './sesion.service';

/** Tiempo mínimo entre dos códigos emitidos a la misma cuenta (no configurable). */
export const ENFRIAMIENTO_CODIGO_MS = 5 * 60 * 1000;
const MINUTO_MS = 60 * 1000;

/** Idéntico exista o no la cuenta, para no revelar qué correos están registrados. */
export const MENSAJE_RECUPERACION =
  'Si el correo está registrado, te enviaremos un código de recuperación.';
/** Único mensaje de fallo: no distingue código erróneo, vencido, usado, agotado ni cuenta inexistente. */
export const MENSAJE_CODIGO_INVALIDO =
  'El código no es válido o ya venció. Solicita uno nuevo e inténtalo de nuevo.';
export const MENSAJE_CONTRASENA_CAMBIADA =
  'Tu contraseña fue actualizada. Ya puedes iniciar sesión con la nueva.';

@Injectable()
export class RecuperacionService {
  private readonly logger = new Logger(RecuperacionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly usuarios: UsuariosService,
    private readonly fundaciones: FundacionesService,
    private readonly sesion: SesionService,
    @Inject(MAIL_SERVICE) private readonly mail: IMailService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  /**
   * Solo hace un SELECT antes de responder; la escritura y el envío ocurren después, sin
   * `await`, para que el tiempo de respuesta no delate si la cuenta existe.
   */
  async solicitar(email: string): Promise<{ mensaje: string }> {
    const usuario = await this.usuarios.buscarPorEmail(email);
    if (usuario) {
      void this.emitir(usuario).catch((error: unknown) => {
        // Sin datos de la petición: el código nunca se registra.
        this.logger.error(
          `No se pudo emitir el código de recuperación del usuario ${usuario.id}: ${mensajeDe(error)}`,
        );
      });
    }
    return { mensaje: MENSAJE_RECUPERACION };
  }

  async restablecer(dto: RestablecerContrasenaDto): Promise<{ mensaje: string }> {
    // bcrypt domina el coste: todos los caminos de fallo tardan lo mismo que el éxito.
    const nuevoHash = await hashearContrasena(dto.nuevaContrasena);
    const ahora = new Date();

    const usuario = await this.usuarios.buscarPorEmail(dto.email);
    if (!usuario) throw this.codigoInvalido();

    // El intento se cuenta antes de comparar; el contador y el límite se evalúan en la misma sentencia.
    const hashVigente = await this.usuarios.reclamarIntentoCodigo(
      usuario.id,
      this.config.get('RESET_CODE_MAX_INTENTOS', { infer: true }),
      ahora,
    );
    if (!hashVigente) throw this.codigoInvalido();

    const hashPresentado = hashearCodigo(this.secreto(), usuario.id, dto.codigo);
    if (!hashesIguales(hashVigente, hashPresentado)) throw this.codigoInvalido();

    const cambiada = await this.dataSource.transaction(async (manager) => {
      const consumido = await this.usuarios.restablecerContrasena(
        usuario.id,
        hashVigente,
        nuevoHash,
        manager,
      );
      if (!consumido) return false;
      await this.sesion.revocarTodas(usuario.id, manager);
      return true;
    });
    // Otra petición con el mismo código lo consumió primero.
    if (!cambiada) throw this.codigoInvalido();
    return { mensaje: MENSAJE_CONTRASENA_CAMBIADA };
  }

  private async emitir(usuario: UsuarioCredenciales): Promise<void> {
    // Inactiva: no tiene acceso y un reset no la reactiva. Sin verificar: debe usar el reenvío de verificación.
    if (!usuario.activo || !usuario.emailVerificado) return;

    const ahora = new Date();
    const vigenciaMs = this.vigenciaMin() * MINUTO_MS;
    const codigo = generarCodigo();
    // El último envío es `expira − vigencia`: solo se emite otro si ya pasó el enfriamiento.
    const guardado = await this.usuarios.guardarCodigoRecuperacion(
      usuario.id,
      hashearCodigo(this.secreto(), usuario.id, codigo),
      new Date(ahora.getTime() + vigenciaMs),
      new Date(ahora.getTime() + vigenciaMs - ENFRIAMIENTO_CODIGO_MS),
    );
    if (!guardado) return;

    await this.mail.enviar({
      para: usuario.email,
      plantilla: 'recuperacion-contrasena',
      datos: {
        nombre: await this.nombreDe(usuario),
        codigo,
        minutosVigencia: this.vigenciaMin(),
      },
    });
  }

  private async nombreDe(usuario: UsuarioCredenciales): Promise<string> {
    if (usuario.rol === 'fundacion') {
      return (await this.fundaciones.obtenerPorUsuarioId(usuario.id))?.nombre ?? 'usuario';
    }
    const perfil = await this.usuarios.obtenerPerfil(usuario.id);
    return perfil?.adoptante?.primerNombre ?? 'usuario';
  }

  private codigoInvalido(): BadRequestException {
    return new BadRequestException(MENSAJE_CODIGO_INVALIDO);
  }

  private secreto(): string {
    return this.config.get('JWT_REFRESH_SECRET', { infer: true });
  }

  private vigenciaMin(): number {
    return this.config.get('RESET_CODE_EXPIRA_MIN', { infer: true });
  }
}

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : 'error desconocido';
}
