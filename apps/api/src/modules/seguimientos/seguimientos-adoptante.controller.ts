import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFiles,
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
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import type { UsuarioAutenticado } from '../../common/auth/usuario-autenticado';
import { IdEnteroPipe } from '../../common/pipes/id-entero.pipe';
import { ArchivosMultiplesInterceptor } from '../storage/archivos-multiples.interceptor';
import { CabecerasDescargaSegura, enviarDescarga } from '../storage/descarga';
import { ConsultaSeguimientosDto } from './dto/consultas.dto';
import { EnviarReporteDto } from './dto/enviar-reporte.dto';
import {
  SeguimientoDetalleAdoptanteDto,
  SeguimientosAdoptantePaginadoDto,
} from './dto/respuestas.dto';
import { EvidenciasService } from './evidencias.service';
import { ReporteService } from './reporte.service';
import { MAX_FOTOS, MAX_TEXTO } from './seguimientos.constants';
import { aDetalleAdoptanteDto, aListaAdoptanteDto } from './seguimientos.mapeo';
import { SeguimientosService } from './seguimientos.service';

/** Seguimientos del adoptante: cada uno ve únicamente los de sus adopciones. */
@ApiTags('Seguimientos — Adoptante')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sesión no válida o vencida' })
@ApiForbiddenResponse({ description: 'Solo adoptantes' })
@Roles('adoptante')
@Controller()
export class SeguimientosAdoptanteController {
  constructor(
    private readonly seguimientos: SeguimientosService,
    private readonly reportes: ReporteService,
    private readonly evidencias: EvidenciasService,
  ) {}

  @Get('mis-seguimientos')
  @ApiOperation({
    summary: 'Seguimientos de mis adopciones, de la fecha más reciente a la más antigua',
  })
  @ApiOkResponse({ type: SeguimientosAdoptantePaginadoDto })
  async listar(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Query() consulta: ConsultaSeguimientosDto,
  ): Promise<SeguimientosAdoptantePaginadoDto> {
    const pagina = await this.seguimientos.listarMios(
      usuario.id,
      { estado: consulta.estado, tipo: consulta.tipo, adopcionId: consulta.adopcionId },
      consulta,
    );
    return { ...pagina, data: pagina.data.map(aListaAdoptanteDto) };
  }

  @Get('mis-seguimientos/:id')
  @ApiOperation({
    summary: 'Detalle de un seguimiento mío, con mi reporte (sin la valoración de la fundación)',
  })
  @ApiOkResponse({ type: SeguimientoDetalleAdoptanteDto })
  @ApiNotFoundResponse({ description: 'El seguimiento no existe' })
  async obtener(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Param('id', IdEnteroPipe) id: number,
  ): Promise<SeguimientoDetalleAdoptanteDto> {
    return aDetalleAdoptanteDto(await this.seguimientos.obtenerMio(usuario.id, id));
  }

  // Sube archivos y escribe en la base: límite por IP más estricto que el global.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('seguimientos/:id/reporte')
  @UseInterceptors(ArchivosMultiplesInterceptor('fotos', MAX_FOTOS))
  @ApiOperation({
    summary: `Envía (o reemplaza) el reporte de un seguimiento de tipo reporte: comentarios y hasta ${MAX_FOTOS} fotos JPG o PNG de máx. 5 MB`,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['comentarios'],
      properties: {
        comentarios: { type: 'string', maxLength: MAX_TEXTO },
        fotos: { type: 'array', maxItems: MAX_FOTOS, items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @ApiCreatedResponse({ type: SeguimientoDetalleAdoptanteDto })
  @ApiBadRequestResponse({ description: 'Comentarios, fotos o cantidad de fotos inválidos' })
  @ApiPayloadTooLargeResponse({ description: 'Una foto supera 5 MB' })
  @ApiNotFoundResponse({ description: 'El seguimiento no existe' })
  @ApiConflictResponse({
    description: 'Es una visita, o el seguimiento ya está realizado o cancelado',
  })
  async enviarReporte(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Param('id', IdEnteroPipe) id: number,
    @Body() dto: EnviarReporteDto,
    @UploadedFiles() fotos?: Express.Multer.File[],
  ): Promise<SeguimientoDetalleAdoptanteDto> {
    const detalle = await this.reportes.enviar(
      usuario.id,
      id,
      dto.comentarios,
      (fotos ?? []).map((f) => f.buffer),
    );
    return aDetalleAdoptanteDto(detalle);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('mis-seguimientos/:id/evidencias/:evidenciaId')
  @CabecerasDescargaSegura()
  @ApiOperation({ summary: 'Descarga una foto de mi propio reporte' })
  @ApiProduces('image/jpeg', 'image/png')
  @ApiNotFoundResponse({ description: 'El seguimiento o la foto no existen' })
  async descargarFoto(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Param('id', IdEnteroPipe) id: number,
    @Param('evidenciaId', IdEnteroPipe) evidenciaId: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return enviarDescarga(
      res,
      await this.evidencias.leer(id, evidenciaId, { tipo: 'adoptante', usuarioId: usuario.id }),
    );
  }
}
