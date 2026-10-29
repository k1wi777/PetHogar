import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { SolicitudAutenticada, UsuarioAutenticado } from './usuario-autenticado';

/** Usuario autenticado de la petición (id y rol); solo existe en rutas no públicas. */
export const CurrentUser = createParamDecorator(
  (_datos: unknown, contexto: ExecutionContext): UsuarioAutenticado => {
    const { user } = contexto.switchToHttp().getRequest<SolicitudAutenticada>();
    if (!user) throw new UnauthorizedException('Sesión no válida o vencida');
    return user;
  },
);
