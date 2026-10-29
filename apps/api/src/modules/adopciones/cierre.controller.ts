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
import { aAdopcionFundacionDto, RUTA_ACTA_FUNDACION } from './adopciones.mapeo';
import { CierreAdopcionService } from './cierre-adopcion.service';
import { CierreAdopcionDto } from './dto/cierre-adopcion.dto';
import { AdopcionFundacionDto } from './dto/respuestas.dto';

/** Cierre de una adopción por la fundación dueña; una ajena responde igual que una inexistente. */
@ApiTags('Adopciones — Fundación')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sesión no válida o vencida' })
@ApiForbiddenResponse({ description: 'Solo fundaciones aprobadas' })
@Roles('fundacion')
@UseGuards(ApprovedFoundationGuard)
@Controller('adopciones')
export class CierreController {
  constructor(private readonly cierre: CierreAdopcionService) {}

  @Patch(':id/estado')
  @ApiOperation({
    summary:
      'Finaliza o revoca una adopción activa. Cancela sus seguimientos pendientes y, al revocar, la mascota vuelve a disponible o queda inactiva; todo en una transacción',
  })
  @ApiOkResponse({ type: AdopcionFundacionDto })
  @ApiBadRequestResponse({ description: 'Falta el motivo o el destino de la mascota al revocar' })
  @ApiNotFoundResponse({ description: 'La adopción no existe' })
  @ApiConflictResponse({ description: 'La adopción ya está cerrada' })
  async cerrar(
    @FundacionId() fundacionId: number,
    @Param('id', IdEnteroPipe) id: number,
    @Body() dto: CierreAdopcionDto,
  ): Promise<AdopcionFundacionDto> {
    return aAdopcionFundacionDto(
      await this.cierre.cerrar(id, fundacionId, dto),
      RUTA_ACTA_FUNDACION,
    );
  }
}
