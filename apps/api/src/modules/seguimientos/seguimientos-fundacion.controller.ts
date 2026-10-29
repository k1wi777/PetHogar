import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Roles } from '../../common/auth/roles.decorator';
import { IdEnteroPipe } from '../../common/pipes/id-entero.pipe';
import { FundacionId } from '../fundaciones/decorators/fundacion-id.decorator';
import { ApprovedFoundationGuard } from '../fundaciones/guards/approved-foundation.guard';
import { ArchivosMultiplesInterceptor } from '../storage/archivos-multiples.interceptor';
import { CabecerasDescargaSegura, enviarDescarga } from '../storage/descarga';
import { ConsultaSeguimientosDto } from './dto/consultas.dto';
import { ProgramarSeguimientoDto } from './dto/programar-seguimiento.dto';
import { RegistrarResultadoDto } from './dto/registrar-resultado.dto';
import {
  SeguimientoDetalleFundacionDto,
  SeguimientosFundacionPaginadoDto,
} from './dto/respuestas.dto';
import { EvidenciasService } from './evidencias.service';
import { ResultadoService } from './resultado.service';
import { MAX_FOTOS, MAX_TEXTO } from './seguimientos.constants';
import { aDetalleFundacionDto, aListaFundacionDto } from './seguimientos.mapeo';
import { SeguimientosService } from './seguimientos.service';

/** Seguimientos de las adopciones de la fundación; uno ajeno responde igual que uno inexistente. */
@ApiTags('Seguimientos — Fundación')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sesión no válida o vencida' })
@ApiForbiddenResponse({ description: 'Solo fundaciones aprobadas' })
@Roles('fundacion')
@UseGuards(ApprovedFoundationGuard)
@Controller()
export class SeguimientosFundacionController {
  constructor(
    private readonly seguimientos: SeguimientosService,
    private readonly resultados: ResultadoService,
    private readonly evidencias: EvidenciasService,
  ) {}

  @Post('adopciones/:id/seguimientos')
  @ApiOperation({
    summary: 'Programa una visita o un reporte de seguimiento en una adopción activa',
  })
  @ApiCreatedResponse({ type: SeguimientoDetalleFundacionDto })
  @ApiBadRequestResponse({
    description: 'Fecha inválida, no posterior a la entrega o anterior a hoy',
  })
  @ApiNotFoundResponse({ description: 'La adopción no existe' })
  @ApiConflictResponse({ description: 'La adopción está cerrada o el seguimiento ya existe' })
  async programar(
    @FundacionId() fundacionId: number,
    @Param('id', IdEnteroPipe) adopcionId: number,
    @Body() dto: ProgramarSeguimientoDto,
  ): Promise<SeguimientoDetalleFundacionDto> {
    return aDetalleFundacionDto(await this.seguimientos.programar(fundacionId, adopcionId, dto));
  }

  @Get('fundacion/seguimientos')
  @ApiOperation({
    summary: 'Seguimientos de mis adopciones, de la fecha más reciente a la más antigua',
  })
  @ApiOkResponse({ type: SeguimientosFundacionPaginadoDto })
  async listar(
    @FundacionId() fundacionId: number,
    @Query() consulta: ConsultaSeguimientosDto,
  ): Promise<SeguimientosFundacionPaginadoDto> {
    const pagina = await this.seguimientos.listarDeFundacion(
      fundacionId,
      { estado: consulta.estado, tipo: consulta.tipo, adopcionId: consulta.adopcionId },
      consulta,
    );
    return { ...pagina, data: pagina.data.map(aListaFundacionDto) };
  }

  @Get('fundacion/seguimientos/:id')
  @ApiOperation({
    summary: 'Detalle de un seguimiento: reporte del adoptante, resultado y fotos',
  })
  @ApiOkResponse({ type: SeguimientoDetalleFundacionDto })
  @ApiNotFoundResponse({ description: 'El seguimiento no existe' })
  async obtener(
    @FundacionId() fundacionId: number,
    @Param('id', IdEnteroPipe) id: number,
  ): Promise<SeguimientoDetalleFundacionDto> {
    return aDetalleFundacionDto(await this.seguimientos.obtenerDeFundacion(fundacionId, id));
  }

  // Sube archivos y escribe en la base: límite por IP más estricto que el global.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Patch('seguimientos/:id/resultado')
  @UseInterceptors(ArchivosMultiplesInterceptor('evidencias', MAX_FOTOS))
  @ApiOperation({
    summary: `Registra el resultado y cierra el seguimiento: fecha realizada, bienestar, observaciones y hasta ${MAX_FOTOS} evidencias JPG o PNG de máx. 5 MB. Con bienestar malo se genera una alerta`,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['fechaRealizada', 'estadoBienestar', 'observaciones'],
      properties: {
        fechaRealizada: { type: 'string', example: '2026-12-14' },
        estadoBienestar: { type: 'string', enum: ['bueno', 'regular', 'malo'] },
        observaciones: { type: 'string', maxLength: MAX_TEXTO },
        evidencias: {
          type: 'array',
          maxItems: MAX_FOTOS,
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiOkResponse({ type: SeguimientoDetalleFundacionDto })
  @ApiBadRequestResponse({ description: 'Datos, fecha o archivos inválidos' })
  @ApiPayloadTooLargeResponse({ description: 'Una foto supera 5 MB' })
  @ApiNotFoundResponse({ description: 'El seguimiento no existe' })
  @ApiConflictResponse({
    description: 'Ya está realizado o cancelado, o es un reporte que el adoptante todavía no envió',
  })
  async registrarResultado(
    @FundacionId() fundacionId: number,
    @Param('id', IdEnteroPipe) id: number,
    @Body() dto: RegistrarResultadoDto,
    @UploadedFiles() evidencias?: Express.Multer.File[],
  ): Promise<SeguimientoDetalleFundacionDto> {
    const detalle = await this.resultados.registrar(
      id,
      fundacionId,
      dto,
      (evidencias ?? []).map((f) => f.buffer),
    );
    return aDetalleFundacionDto(detalle);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('fundacion/seguimientos/:id/evidencias/:evidenciaId')
  @CabecerasDescargaSegura()
  @ApiOperation({ summary: 'Descarga una foto del reporte del adoptante o de las evidencias' })
  @ApiProduces('image/jpeg', 'image/png')
  @ApiNotFoundResponse({ description: 'El seguimiento o la foto no existen' })
  async descargarFoto(
    @FundacionId() fundacionId: number,
    @Param('id', IdEnteroPipe) id: number,
    @Param('evidenciaId', IdEnteroPipe) evidenciaId: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return enviarDescarga(
      res,
      await this.evidencias.leer(id, evidenciaId, { tipo: 'fundacion', fundacionId }),
    );
  }
}
