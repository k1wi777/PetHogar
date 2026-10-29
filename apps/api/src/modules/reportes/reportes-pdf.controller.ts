import { Controller, Get, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Roles } from '../../common/auth/roles.decorator';
import { FundacionId } from '../fundaciones/decorators/fundacion-id.decorator';
import { ApprovedFoundationGuard } from '../fundaciones/guards/approved-foundation.guard';
import {
  ConsultaReporteDonacionesDto,
  ConsultaReporteSeguimientosDto,
  ConsultaReporteSolicitudesDto,
} from './dto/consultas-reporte.dto';
import { enviarPdf } from './pdf/respuesta-pdf';
import { ReportesPdfService } from './reportes-pdf.service';

const PDF = { description: 'Archivo PDF', schema: { type: 'string', format: 'binary' } } as const;

/**
 * Reportes en PDF de la fundación aprobada: la fundación sale siempre del token y cada PDF
 * contiene solo sus datos. Son costosos (CPU), por eso 10 por minuto.
 */
@ApiTags('Reportes — Fundación')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sesión no válida o vencida' })
@ApiForbiddenResponse({ description: 'Solo fundaciones aprobadas' })
@Roles('fundacion')
@UseGuards(ApprovedFoundationGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Controller('fundacion/reportes')
export class ReportesPdfController {
  constructor(private readonly reportes: ReportesPdfService) {}

  @Get('solicitudes.pdf')
  @ApiOperation({ summary: 'Listado de solicitudes de adopción en PDF (hasta 1000 filas)' })
  @ApiProduces('application/pdf')
  @ApiOkResponse(PDF)
  @ApiBadRequestResponse({ description: 'Filtros inválidos o rango invertido' })
  async solicitudes(
    @FundacionId() fundacionId: number,
    @Query() consulta: ConsultaReporteSolicitudesDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const pdf = await this.reportes.solicitudes(fundacionId, consulta);
    return enviarPdf(res, pdf, 'reporte-solicitudes.pdf', { sinCache: true });
  }

  @Get('seguimientos.pdf')
  @ApiOperation({ summary: 'Reporte de seguimientos post-adopción en PDF (hasta 1000 filas)' })
  @ApiProduces('application/pdf')
  @ApiOkResponse(PDF)
  @ApiBadRequestResponse({ description: 'Filtros inválidos o rango invertido' })
  async seguimientos(
    @FundacionId() fundacionId: number,
    @Query() consulta: ConsultaReporteSeguimientosDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const pdf = await this.reportes.seguimientos(fundacionId, consulta);
    return enviarPdf(res, pdf, 'reporte-seguimientos.pdf', { sinCache: true });
  }

  @Get('donaciones.pdf')
  @ApiOperation({ summary: 'Reporte de donaciones en PDF con totales por tipo (hasta 1000 filas)' })
  @ApiProduces('application/pdf')
  @ApiOkResponse(PDF)
  @ApiBadRequestResponse({ description: 'Filtros inválidos o rango invertido' })
  async donaciones(
    @FundacionId() fundacionId: number,
    @Query() consulta: ConsultaReporteDonacionesDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const pdf = await this.reportes.donaciones(fundacionId, consulta);
    return enviarPdf(res, pdf, 'reporte-donaciones.pdf', { sinCache: true });
  }
}
