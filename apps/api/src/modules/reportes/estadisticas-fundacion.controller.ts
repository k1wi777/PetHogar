import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../../common/auth/roles.decorator';
import { FundacionId } from '../fundaciones/decorators/fundacion-id.decorator';
import { ApprovedFoundationGuard } from '../fundaciones/guards/approved-foundation.guard';
import { ConsultaPeriodoDto } from './dto/consulta-periodo.dto';
import { EstadisticasDto } from './dto/estadisticas.dto';
import { EstadisticasService } from './estadisticas.service';

/** Estadísticas de la fundación aprobada: la fundación sale siempre del token. */
@ApiTags('Reportes — Fundación')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sesión no válida o vencida' })
@ApiForbiddenResponse({ description: 'Solo fundaciones aprobadas' })
@Roles('fundacion')
@UseGuards(ApprovedFoundationGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('fundacion/estadisticas')
export class EstadisticasFundacionController {
  constructor(private readonly estadisticas: EstadisticasService) {}

  @Get()
  @ApiOperation({
    summary:
      'Adopciones por mes y especie, solicitudes, seguimientos y donaciones de mi fundación, con rango opcional',
  })
  @ApiOkResponse({ type: EstadisticasDto })
  @ApiBadRequestResponse({ description: 'Fechas inválidas o rango invertido' })
  obtener(
    @FundacionId() fundacionId: number,
    @Query() consulta: ConsultaPeriodoDto,
  ): Promise<EstadisticasDto> {
    return this.estadisticas.deFundacion(fundacionId, consulta.desde, consulta.hasta);
  }
}
