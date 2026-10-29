import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation';
import { UsuariosService } from '../usuarios/usuarios.service';
import { comparacionFicticia, compararContrasena } from './contrasena';
import type { LoginDto } from './dto/login.dto';
import { SesionEmitida, SesionService } from './sesion.service';

const MINUTO_MS = 60 * 1000;
/** Idéntico para correo inexistente y contraseña errónea. */
export const MENSAJE_CREDENCIALES = 'Correo o contraseña incorrectos';
export const MENSAJE_CUENTA_INACTIVA =
  'Tu cuenta está desactivada. Comunícate con un administrador de PetHogar.';
export const MENSAJE_SIN_VERIFICAR =
  'Debes verificar tu correo antes de iniciar sesión. Revisa tu bandeja o solicita un nuevo enlace.';

@Injectable()
export class LoginService {
  constructor(
    private readonly usuarios: UsuariosService,
    private readonly sesion: SesionService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async iniciarSesion(dto: LoginDto): Promise<SesionEmitida> {
    const ahora = new Date();
    const usuario = await this.usuarios.buscarPorEmail(dto.email);
    if (!usuario) {
      await comparacionFicticia(dto.contrasena);
      throw new UnauthorizedException(MENSAJE_CREDENCIALES);
    }

    // Bloqueado: no se compara la contraseña ni se amplía el bloqueo.
    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta.getTime() > ahora.getTime()) {
      const minutos = Math.ceil((usuario.bloqueadoHasta.getTime() - ahora.getTime()) / MINUTO_MS);
      throw new ForbiddenException(
        `Cuenta bloqueada temporalmente por demasiados intentos fallidos. Intenta de nuevo en ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}.`,
      );
    }

    if (!(await compararContrasena(dto.contrasena, usuario.contrasenaHash))) {
      await this.usuarios.registrarIntentoFallido(
        usuario.id,
        this.config.get('LOGIN_MAX_INTENTOS', { infer: true }),
        this.config.get('LOGIN_BLOQUEO_MIN', { infer: true }) * MINUTO_MS,
        ahora,
      );
      throw new UnauthorizedException(MENSAJE_CREDENCIALES);
    }

    // El estado de la cuenta solo se revela a quien conoce la contraseña.
    if (!usuario.activo) throw new ForbiddenException(MENSAJE_CUENTA_INACTIVA);
    if (!usuario.emailVerificado) throw new ForbiddenException(MENSAJE_SIN_VERIFICAR);

    if (usuario.intentosFallidos > 0 || usuario.bloqueadoHasta) {
      await this.usuarios.reiniciarIntentos(usuario.id);
    }
    return this.sesion.abrir({ id: usuario.id, rol: usuario.rol }, ahora);
  }
}
