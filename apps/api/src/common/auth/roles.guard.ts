import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ES_PUBLICA } from './public.decorator';
import { ROLES_PERMITIDOS } from './roles.decorator';
import type { RolNombre, SolicitudAutenticada } from './usuario-autenticado';

/** Sin `@Roles()` deja pasar a cualquier autenticado; con él exige que el rol coincida. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const objetivos = [contexto.getHandler(), contexto.getClass()];
    if (this.reflector.getAllAndOverride<boolean | undefined>(ES_PUBLICA, objetivos)) return true;

    const roles = this.reflector.getAllAndOverride<RolNombre[] | undefined>(
      ROLES_PERMITIDOS,
      objetivos,
    );
    if (!roles || roles.length === 0) return true;

    const { user } = contexto.switchToHttp().getRequest<SolicitudAutenticada>();
    if (!user || !roles.includes(user.rol)) {
      throw new ForbiddenException('No tienes permiso para realizar esta acción');
    }
    return true;
  }
}
