import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ES_PUBLICA } from './public.decorator';
import { ROLES_NOMBRES, type RolNombre, type SolicitudAutenticada } from './usuario-autenticado';

export const MENSAJE_SESION_INVALIDA = 'Sesión no válida o vencida';

interface PayloadAcceso {
  sub: unknown;
  rol: unknown;
}

/**
 * Exige un access token válido salvo en rutas `@Public()`. No consulta la base de datos:
 * un usuario desactivado conserva su access token hasta que vence (máx. 15 min).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const esPublica = this.reflector.getAllAndOverride<boolean | undefined>(ES_PUBLICA, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (esPublica) return true;

    const solicitud = contexto.switchToHttp().getRequest<SolicitudAutenticada>();
    const token = extraerBearer(solicitud.headers.authorization);
    if (!token) throw new UnauthorizedException(MENSAJE_SESION_INVALIDA);

    let payload: PayloadAcceso;
    try {
      // El algoritmo se fija para impedir que el token elija el suyo (p. ej. `none`).
      payload = await this.jwt.verifyAsync<PayloadAcceso>(token, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedException(MENSAJE_SESION_INVALIDA);
    }
    if (!Number.isInteger(payload.sub) || !esRol(payload.rol)) {
      throw new UnauthorizedException(MENSAJE_SESION_INVALIDA);
    }
    solicitud.user = { id: payload.sub as number, rol: payload.rol };
    return true;
  }
}

function extraerBearer(cabecera: string | undefined): string | undefined {
  const [esquema, token, ...resto] = (cabecera ?? '').split(' ');
  return esquema === 'Bearer' && token && resto.length === 0 ? token : undefined;
}

function esRol(valor: unknown): valor is RolNombre {
  return ROLES_NOMBRES.includes(valor as RolNombre);
}
