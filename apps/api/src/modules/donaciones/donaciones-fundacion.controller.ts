import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
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
import { ArchivoUnicoInterceptor } from '../storage/archivo-unico.interceptor';
import { CabecerasDescargaSegura, enviarDescarga } from '../storage/descarga';
import { ComprobanteService } from './comprobante.service';
import { aDonacionFundacionDto, aResumenDto } from './donaciones.mapeo';
import { DonacionesService } from './donaciones.service';
import { ConsultaDonacionesDto } from './dto/consulta-donaciones.dto';
import { CrearDonacionManualDto } from './dto/crear-donacion-manual.dto';
import { DonacionesFundacionPaginadoDto, DonacionResumenDto } from './dto/respuestas.dto';

/**
 * Donaciones de la fundación aprobada: la fundación sale siempre del token (`@FundacionId()`), nunca
 * del cuerpo ni de la ruta; una donación ajena responde igual que una inexistente.
 */
@ApiTags('Donaciones — Fundación')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sesión no válida o vencida' })
@ApiForbiddenResponse({ description: 'Solo fundaciones aprobadas' })
@Roles('fundacion')
@UseGuards(ApprovedFoundationGuard)
@Controller('fundacion/donaciones')
export class DonacionesFundacionController {
  constructor(
    private readonly donaciones: DonacionesService,
    private readonly comprobantes: ComprobanteService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Donaciones recibidas, de la más reciente a la más antigua, con totales por tipo del periodo y tipo filtrados',
  })
  @ApiOkResponse({ type: DonacionesFundacionPaginadoDto })
  @ApiBadRequestResponse({ description: 'Fechas inválidas o periodo invertido' })
  async listar(
    @FundacionId() fundacionId: number,
    @Query() consulta: ConsultaDonacionesDto,
  ): Promise<DonacionesFundacionPaginadoDto> {
    const pagina = await this.donaciones.listar(fundacionId, consulta);
    return { ...pagina, data: pagina.data.map(aDonacionFundacionDto) };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @UseInterceptors(ArchivoUnicoInterceptor('comprobante'))
  @ApiOperation({
    summary: 'Registra un aporte presencial (sin usuario donante) con comprobante opcional',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['nombreDonante', 'tipo'],
      properties: {
        nombreDonante: { type: 'string', minLength: 2, maxLength: 100 },
        tipo: { type: 'string', enum: ['economica', 'especie'] },
        monto: { type: 'string', example: '50000.00', description: 'Obligatorio si es económica' },
        descripcion: {
          type: 'string',
          maxLength: 300,
          description: 'Obligatoria si es en especie',
        },
        comprobante: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiCreatedResponse({ type: DonacionResumenDto })
  @ApiBadRequestResponse({ description: 'Datos o archivo inválidos' })
  @ApiPayloadTooLargeResponse({ description: 'El archivo supera 5 MB' })
  async crearManual(
    @FundacionId() fundacionId: number,
    @Body() dto: CrearDonacionManualDto,
    @UploadedFile() comprobante?: Express.Multer.File,
  ): Promise<DonacionResumenDto> {
    return aResumenDto(await this.donaciones.crearManual(fundacionId, dto, comprobante?.buffer));
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(':id/comprobante')
  @CabecerasDescargaSegura()
  @ApiOperation({ summary: 'Descarga el comprobante de una donación de mi fundación' })
  @ApiProduces('application/pdf', 'image/jpeg', 'image/png')
  @ApiNotFoundResponse({ description: 'La donación o su comprobante no existe' })
  async comprobante(
    @FundacionId() fundacionId: number,
    @Param('id', IdEnteroPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return enviarDescarga(res, await this.comprobantes.leer(id, fundacionId));
  }
}
