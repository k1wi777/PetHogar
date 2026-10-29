import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../../common/auth/roles.decorator';
import { ConsultaEstadisticasAdminDto } from './dto/consulta-periodo.dto';
import { EstadisticasDto } from './dto/estadisticas.dto';
import { EstadisticasService } from './estadisticas.service';

@ApiTags('Administración — Estadísticas')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sesión no válida o vencida' })
@ApiForbiddenResponse({ description: 'Solo administradores' })
@Roles('administrador')
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('admin/estadisticas')
export class EstadisticasAdminController {
  constructor(private readonly estadisticas: EstadisticasService) {}

  @Get()
  @ApiOperation({
    summary: 'Estadísticas globales de la plataforma, o de una fundación si se indica, con rango',
  })
  @ApiOkResponse({ type: EstadisticasDto })
  @ApiBadRequestResponse({ description: 'Fechas o fundación inválidas, o rango invertido' })
  @ApiNotFoundResponse({ description: 'La fundación no existe' })
  obtener(@Query() consulta: ConsultaEstadisticasAdminDto): Promise<EstadisticasDto> {
    return this.estadisticas.deAdministrador(consulta.fundacionId, consulta.desde, consulta.hasta);
  }
}
