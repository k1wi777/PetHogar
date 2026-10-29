import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { SolicitudAutenticada } from '../../../common/auth/usuario-autenticado';

export type SolicitudConFundacion = SolicitudAutenticada & { fundacionId?: number };

/**
 * Id de la fundación del usuario autenticado. Lo deja `ApprovedFoundationGuard` (que ya consulta
 * la fundación en cada petición), así las rutas de gestión no repiten la consulta ni toman el id
 * del cuerpo o de la ruta. Solo existe en rutas protegidas por ese guard.
 */
export const FundacionId = createParamDecorator(
  (_datos: unknown, contexto: ExecutionContext): number => {
    const { fundacionId } = contexto.switchToHttp().getRequest<SolicitudConFundacion>();
    if (fundacionId === undefined) {
      throw new ForbiddenException('Esta acción es exclusiva de fundaciones registradas');
    }
    return fundacionId;
  },
);
