import { Controller, Get, Param, Res, StreamableFile } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../common/auth/public.decorator';
import { IdEnteroPipe } from '../../common/pipes/id-entero.pipe';
import { enviarPdf } from './pdf/respuesta-pdf';
import { ReportesPdfService } from './reportes-pdf.service';

/** Ficha pública en PDF: sin autenticación y con los mismos datos que el catálogo. */
@ApiTags('Reportes — Ficha pública')
@Controller('mascotas')
export class FichaPdfController {
  constructor(private readonly reportes: ReportesPdfService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get(':id/ficha.pdf')
  @ApiOperation({ summary: 'Ficha en PDF de una mascota disponible' })
  @ApiProduces('application/pdf')
  @ApiOkResponse({ description: 'Archivo PDF', schema: { type: 'string', format: 'binary' } })
  @ApiNotFoundResponse({ description: 'La mascota no existe o no está disponible' })
  async ficha(
    @Param('id', IdEnteroPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return enviarPdf(res, await this.reportes.fichaMascota(id), `ficha-mascota-${id}.pdf`, {
      sinCache: false,
    });
  }
}
