import {
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
import { ArchivoUnicoInterceptor } from '../storage/archivo-unico.interceptor';
import { CabecerasDescargaSegura, enviarDescarga } from '../storage/descarga';
import { aAdopcionFundacionDto, RUTA_ACTA_FUNDACION } from './adopciones.mapeo';
import { AdopcionesService } from './adopciones.service';
import { ConsultaAdopcionesDto } from './dto/consulta-adopciones.dto';
import { AdopcionesFundacionPaginadoDto, AdopcionFundacionDto } from './dto/respuestas.dto';

/** Adopciones de las mascotas de la fundación; una ajena responde igual que una inexistente. */
@ApiTags('Adopciones — Fundación')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sesión no válida o vencida' })
@ApiForbiddenResponse({ description: 'Solo fundaciones aprobadas' })
@Roles('fundacion')
@UseGuards(ApprovedFoundationGuard)
@Controller('fundacion/adopciones')
export class AdopcionesFundacionController {
  constructor(private readonly adopciones: AdopcionesService) {}

  @Get()
  @ApiOperation({
    summary: 'Adopciones de mis mascotas, con el adoptante (datos mínimos) y el acta',
  })
  @ApiOkResponse({ type: AdopcionesFundacionPaginadoDto })
  async listar(
    @FundacionId() fundacionId: number,
    @Query() consulta: ConsultaAdopcionesDto,
  ): Promise<AdopcionesFundacionPaginadoDto> {
    const pagina = await this.adopciones.listarDeFundacion(
      fundacionId,
      { estado: consulta.estado },
      consulta,
    );
    return {
      ...pagina,
      data: pagina.data.map((a) => aAdopcionFundacionDto(a, RUTA_ACTA_FUNDACION)),
    };
  }

  // Sube un archivo al almacenamiento privado: límite por IP más estricto que el global.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/acta')
  @UseInterceptors(ArchivoUnicoInterceptor('acta'))
  @ApiOperation({
    summary: 'Sube el acta firmada (PDF, JPG o PNG, máx. 5 MB); reemplaza la anterior',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['acta'],
      properties: { acta: { type: 'string', format: 'binary' } },
    },
  })
  @ApiCreatedResponse({ type: AdopcionFundacionDto })
  @ApiBadRequestResponse({ description: 'El archivo no es PDF, JPG o PNG válido' })
  @ApiPayloadTooLargeResponse({ description: 'El archivo supera 5 MB' })
  @ApiNotFoundResponse({ description: 'La adopción no existe' })
  @ApiConflictResponse({ description: 'La adopción ya está cerrada' })
  async subirActa(
    @FundacionId() fundacionId: number,
    @Param('id', IdEnteroPipe) id: number,
    @UploadedFile() archivo?: Express.Multer.File,
  ): Promise<AdopcionFundacionDto> {
    return aAdopcionFundacionDto(
      await this.adopciones.subirActa(id, fundacionId, archivo?.buffer),
      RUTA_ACTA_FUNDACION,
    );
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(':id/acta')
  @CabecerasDescargaSegura()
  @ApiOperation({ summary: 'Descarga el acta firmada de una adopción de mi fundación' })
  @ApiProduces('application/pdf', 'image/jpeg', 'image/png')
  @ApiNotFoundResponse({ description: 'La adopción o su acta no existen' })
  async acta(
    @FundacionId() fundacionId: number,
    @Param('id', IdEnteroPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return enviarDescarga(
      res,
      await this.adopciones.leerActa(id, { tipo: 'fundacion', fundacionId }),
    );
  }
}
