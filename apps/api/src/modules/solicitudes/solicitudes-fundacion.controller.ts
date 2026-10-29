import { Controller, Get, Param, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
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
import { CabecerasDescargaSegura, enviarDescarga } from '../storage/descarga';
import { ConsultaSolicitudesFundacionDto } from './dto/consultas.dto';
import {
  SolicitudDetalleFundacionDto,
  SolicitudesFundacionPaginadoDto,
} from './dto/respuestas.dto';
import { FormularioService } from './formulario.service';
import { SolicitudesService } from './solicitudes.service';
import { aDetalleFundacionDto, aResumenFundacionDto } from './solicitudes.mapeo';

/**
 * Solicitudes recibidas por la fundación. La propiedad se comprueba vía mascota en la misma
 * sentencia: una solicitud de una mascota ajena responde igual que una inexistente.
 */
@ApiTags('Solicitudes — Fundación')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sesión no válida o vencida' })
@ApiForbiddenResponse({ description: 'Solo fundaciones aprobadas' })
@Roles('fundacion')
@UseGuards(ApprovedFoundationGuard)
@Controller('fundacion/solicitudes')
export class SolicitudesFundacionController {
  constructor(
    private readonly solicitudes: SolicitudesService,
    private readonly formularios: FormularioService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Solicitudes de mis mascotas, filtrables por estado y mascota' })
  @ApiOkResponse({ type: SolicitudesFundacionPaginadoDto })
  async listar(
    @FundacionId() fundacionId: number,
    @Query() consulta: ConsultaSolicitudesFundacionDto,
  ): Promise<SolicitudesFundacionPaginadoDto> {
    const pagina = await this.solicitudes.listarDeFundacion(
      fundacionId,
      { estado: consulta.estado, mascotaId: consulta.mascotaId },
      consulta,
    );
    return { ...pagina, data: pagina.data.map(aResumenFundacionDto) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una solicitud: adoptante (datos mínimos) y formulario' })
  @ApiOkResponse({ type: SolicitudDetalleFundacionDto })
  @ApiNotFoundResponse({ description: 'La solicitud no existe' })
  async obtener(
    @FundacionId() fundacionId: number,
    @Param('id', IdEnteroPipe) id: number,
  ): Promise<SolicitudDetalleFundacionDto> {
    return aDetalleFundacionDto(await this.solicitudes.obtenerDeFundacion(id, fundacionId));
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(':id/formulario')
  @CabecerasDescargaSegura()
  @ApiOperation({ summary: 'Descarga el formulario firmado (PDF, JPG o PNG según su contenido)' })
  @ApiProduces('application/pdf', 'image/jpeg', 'image/png')
  @ApiNotFoundResponse({ description: 'La solicitud no existe' })
  async formulario(
    @FundacionId() fundacionId: number,
    @Param('id', IdEnteroPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return enviarDescarga(res, await this.formularios.leer(id, { tipo: 'fundacion', fundacionId }));
  }
}
