import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager } from 'typeorm';
import type { UsuarioAutenticado } from '../../common/auth/usuario-autenticado';
import type { EnvironmentVariables } from '../../config/env.validation';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { SesionRespuestaDto } from './dto/respuestas.dto';
import { PerfilService } from './perfil.service';
import { RefreshTokenRepository } from './refresh-token.repository';
import { generarTokenOpaco, hashHmac } from './tokens.util';

const DIA_MS = 24 * 60 * 60 * 1000;
export const MENSAJE_SESION_NO_VALIDA = 'Sesión no válida o vencida. Inicia sesión de nuevo.';

/** Resultado de abrir o renovar una sesión: el refresh token va a la cookie, nunca al cuerpo. */
export interface SesionEmitida {
  respuesta: SesionRespuestaDto;
  refreshToken: string;
  refreshVigenciaMs: number;
}

@Injectable()
export class SesionService {
  private readonly logger = new Logger(SesionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly usuarios: UsuariosService,
    private readonly perfil: PerfilService,
  ) {}

  /** Sesión nueva (login): access token + refresh token guardado solo como HMAC. */
  async abrir(usuario: UsuarioAutenticado, ahora: Date): Promise<SesionEmitida> {
    const refresh = this.nuevoRefresh(ahora);
    await this.refreshTokens.crear(usuario.id, refresh.hash, refresh.expira);
    return this.armarRespuesta(usuario, refresh.token);
  }

  /**
   * Rotación: revoca el refresh presentado y emite uno nuevo en una transacción. Un token ya
   * revocado o rotado se trata como robo: se revocan todas las sesiones del usuario.
   */
  async renovar(tokenPlano: string): Promise<SesionEmitida> {
    const ahora = new Date();
    const registro = await this.refreshTokens.buscarPorHash(this.hashRefresh(tokenPlano));
    if (!registro) throw this.sesionNoValida();
    if (registro.revocado) return this.reutilizacion(registro.usuarioId);
    if (registro.expiraEn.getTime() <= ahora.getTime()) throw this.sesionNoValida();

    const usuario = await this.usuarios.buscarPorId(registro.usuarioId);
    if (!usuario?.activo) throw this.sesionNoValida();

    const sucesor = this.nuevoRefresh(ahora);
    const rotado = await this.dataSource.transaction(async (manager) => {
      if (!(await this.refreshTokens.revocarSiActivo(registro.id, manager))) return false;
      await this.refreshTokens.crear(usuario.id, sucesor.hash, sucesor.expira, manager);
      return true;
    });
    // Otra petición con el mismo token ganó la carrera: equivale a reutilizarlo.
    if (!rotado) return this.reutilizacion(registro.usuarioId);

    return this.armarRespuesta({ id: usuario.id, rol: usuario.rol }, sucesor.token);
  }

  /** Logout: idempotente; un token desconocido o ya revocado no es un error. */
  async revocar(tokenPlano: string): Promise<void> {
    await this.refreshTokens.revocarPorHash(this.hashRefresh(tokenPlano));
  }

  /** Cierra todas las sesiones del usuario; con `manager` participa en la transacción del llamador. */
  revocarTodas(usuarioId: number, manager?: EntityManager): Promise<void> {
    return this.refreshTokens.revocarTodosDeUsuario(usuarioId, manager);
  }

  private async reutilizacion(usuarioId: number): Promise<never> {
    await this.refreshTokens.revocarTodosDeUsuario(usuarioId);
    this.logger.warn(`Reutilización de refresh token: sesiones del usuario ${usuarioId} revocadas`);
    throw this.sesionNoValida();
  }

  private sesionNoValida(): UnauthorizedException {
    return new UnauthorizedException(MENSAJE_SESION_NO_VALIDA);
  }

  private nuevoRefresh(ahora: Date): { token: string; hash: string; expira: Date } {
    const token = generarTokenOpaco();
    return {
      token,
      hash: this.hashRefresh(token),
      expira: new Date(ahora.getTime() + this.refreshVigenciaMs()),
    };
  }

  private hashRefresh(token: string): string {
    return hashHmac(this.config.get('JWT_REFRESH_SECRET', { infer: true }), token);
  }

  private refreshVigenciaMs(): number {
    return this.config.get('JWT_REFRESH_EXPIRES_DAYS', { infer: true }) * DIA_MS;
  }

  private async armarRespuesta(
    usuario: UsuarioAutenticado,
    refreshToken: string,
  ): Promise<SesionEmitida> {
    const accessToken = await this.jwt.signAsync({ sub: usuario.id, rol: usuario.rol });
    return {
      respuesta: {
        accessToken,
        expiresIn: this.config.get('JWT_ACCESS_EXPIRES_MIN', { infer: true }) * 60,
        usuario: await this.perfil.obtener(usuario.id),
      },
      refreshToken,
      refreshVigenciaMs: this.refreshVigenciaMs(),
    };
  }
}
