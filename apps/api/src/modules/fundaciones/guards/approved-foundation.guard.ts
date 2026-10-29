import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { SolicitudAutenticada } from '../../../common/auth/usuario-autenticado';
import { EstadoValidacion } from '../entities/fundacion.enum';
import { FundacionesService } from '../fundaciones.service';

/**
 * Bloquea las rutas operativas de una fundación que no está aprobada. Se aplica con
 * `@UseGuards` junto a `@Roles('fundacion')`. Consulta la BD en cada petición para que una
 * aprobación o un rechazo del administrador surta efecto de inmediato.
 */
@Injectable()
export class ApprovedFoundationGuard implements CanActivate {
  constructor(private readonly fundaciones: FundacionesService) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const { user } = contexto.switchToHttp().getRequest<SolicitudAutenticada>();
    const fundacion = user ? await this.fundaciones.estadoPorUsuarioId(user.id) : null;
    if (!fundacion) {
      throw new ForbiddenException('Esta acción es exclusiva de fundaciones registradas');
    }
    if (fundacion.estadoValidacion === EstadoValidacion.Pendiente) {
      throw new ForbiddenException(
        'Tu fundación está pendiente de validación; podrás usar esta función cuando sea aprobada',
      );
    }
    if (fundacion.estadoValidacion === EstadoValidacion.Rechazada) {
      throw new ForbiddenException(
        'Tu fundación fue rechazada; revisa la observación del administrador',
      );
    }
    return true;
  }
}
