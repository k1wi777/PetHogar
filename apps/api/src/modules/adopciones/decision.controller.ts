import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../common/auth/roles.decorator';
import { IdEnteroPipe } from '../../common/pipes/id-entero.pipe';
import { FundacionId } from '../fundaciones/decorators/fundacion-id.decorator';
import { ApprovedFoundationGuard } from '../fundaciones/guards/approved-foundation.guard';
import { aDetalleFundacionDto } from '../solicitudes/solicitudes.mapeo';
import { aprobacionAResumen } from './decision.mapeo';
import { AprobacionService } from './aprobacion.service';
import { DecisionSolicitudDto } from './dto/decision-solicitud.dto';
import { DecisionResultadoDto } from './dto/respuestas.dto';

/**
 * Decisión sobre una solicitud. Vive en `adopciones` porque aprobar crea la adopción (y así
 * `solicitudes` no depende de `adopciones`); el contrato HTTP es `PATCH /solicitudes/:id/decision`.
 */
@ApiTags('Solicitudes — Fundación')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sesión no válida o vencida' })
@ApiForbiddenResponse({ description: 'Solo fundaciones aprobadas' })
@Roles('fundacion')
@UseGuards(ApprovedFoundationGuard)
@Controller('solicitudes')
export class DecisionController {
  constructor(private readonly aprobacion: AprobacionService) {}

  @Patch(':id/decision')
  @ApiOperation({
    summary:
      'Aprueba o rechaza una solicitud pendiente. Aprobar crea la adopción, marca la mascota como adoptada y rechaza las demás solicitudes, todo en una transacción',
  })
  @ApiOkResponse({ type: DecisionResultadoDto })
  @ApiBadRequestResponse({ description: 'Falta la observación (rechazo) o la fecha de entrega' })
  @ApiNotFoundResponse({ description: 'La solicitud no existe' })
  @ApiConflictResponse({
    description: 'La solicitud ya no está pendiente o la mascota no está disponible',
  })
  async decidir(
    @FundacionId() fundacionId: number,
    @Param('id', IdEnteroPipe) id: number,
    @Body() dto: DecisionSolicitudDto,
  ): Promise<DecisionResultadoDto> {
    const { solicitud, adopcion } = await this.aprobacion.decidir(id, fundacionId, dto);
    return {
      ...aDetalleFundacionDto(solicitud),
      adopcion: adopcion && aprobacionAResumen(adopcion),
    };
  }
}
