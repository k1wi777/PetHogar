import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MENSAJE_SESION_INVALIDA } from '../../../common/auth/jwt-auth.guard';
import { ES_PUBLICA } from '../../../common/auth/public.decorator';
import type { SolicitudAutenticada } from '../../../common/auth/usuario-autenticado';
import { UsuariosService } from '../usuarios.service';

/**
 * Guard global (tras `JwtAuthGuard`, antes de `RolesGuard`): un access token vigente deja de
 * servir en cuanto la cuenta se desactiva, sin esperar a que venza (hasta 15 min). Cuesta una
 * consulta por clave primaria por petición autenticada.
 */
@Injectable()
export class CuentaActivaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly usuarios: UsuariosService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const esPublica = this.reflector.getAllAndOverride<boolean | undefined>(ES_PUBLICA, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (esPublica) return true;

    const { user } = contexto.switchToHttp().getRequest<SolicitudAutenticada>();
    if (!user) return true;

    if (!(await this.usuarios.estaActiva(user.id))) {
      throw new UnauthorizedException(MENSAJE_SESION_INVALIDA);
    }
    return true;
  }
}
