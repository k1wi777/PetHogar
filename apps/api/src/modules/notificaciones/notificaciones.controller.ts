import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { UsuarioAutenticado } from '../../common/auth/usuario-autenticado';
import { IdEnteroPipe } from '../../common/pipes/id-entero.pipe';
import { ConsultaNotificacionesDto } from './dto/consulta-notificaciones.dto';
import {
  ActualizadasDto,
  NoLeidasDto,
  NotificacionDto,
  NotificacionesPaginadoDto,
} from './dto/respuestas.dto';
import { NotificacionesService } from './notificaciones.service';

/**
 * Notificaciones del usuario autenticado, de cualquier rol y sin exigir fundación aprobada (una
 * fundación pendiente o rechazada debe poder leer el resultado de su validación). El usuario sale
 * siempre del token.
 */
@ApiTags('Notificaciones')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sesión no válida o vencida' })
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificaciones: NotificacionesService) {}

  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get()
  @ApiOperation({ summary: 'Mis notificaciones, de la más reciente a la más antigua' })
  @ApiOkResponse({ type: NotificacionesPaginadoDto })
  listar(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Query() consulta: ConsultaNotificacionesDto,
  ): Promise<NotificacionesPaginadoDto> {
    return this.notificaciones.listar(usuario.id, { leida: consulta.leida }, consulta);
  }

  // El front lo consulta cada 30-60 s: tiene más margen que el resto.
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get('no-leidas/count')
  @ApiOperation({ summary: 'Cantidad de mis notificaciones no leídas' })
  @ApiOkResponse({ type: NoLeidasDto })
  contarNoLeidas(@CurrentUser() usuario: UsuarioAutenticado): Promise<NoLeidasDto> {
    return this.notificaciones.contarNoLeidas(usuario.id);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Patch('leer-todas')
  @ApiOperation({ summary: 'Marca como leídas todas mis notificaciones pendientes' })
  @ApiOkResponse({ type: ActualizadasDto })
  leerTodas(@CurrentUser() usuario: UsuarioAutenticado): Promise<ActualizadasDto> {
    return this.notificaciones.marcarTodas(usuario.id);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Patch(':id/leida')
  @ApiOperation({ summary: 'Marca una notificación mía como leída (idempotente)' })
  @ApiOkResponse({ type: NotificacionDto })
  @ApiNotFoundResponse({ description: 'La notificación no existe' })
  leer(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Param('id', IdEnteroPipe) id: number,
  ): Promise<NotificacionDto> {
    return this.notificaciones.marcarLeida(usuario.id, id);
  }
}
