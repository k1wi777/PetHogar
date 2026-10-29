import { SetMetadata } from '@nestjs/common';
import type { RolNombre } from './usuario-autenticado';

export const ROLES_PERMITIDOS = 'rolesPermitidos';

/** Restringe la ruta a los roles indicados; sin él basta con estar autenticado. */
export const Roles = (...roles: RolNombre[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_PERMITIDOS, roles);
