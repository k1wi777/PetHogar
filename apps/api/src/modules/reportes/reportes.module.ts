import { Module } from '@nestjs/common';
import { FundacionesModule } from '../fundaciones/fundaciones.module';
import { MascotasModule } from '../mascotas/mascotas.module';
import { ReportesPdfController } from './reportes-pdf.controller';
import { FichaPdfController } from './ficha-pdf.controller';
import { EstadisticasAdminController } from './estadisticas-admin.controller';
import { EstadisticasFundacionController } from './estadisticas-fundacion.controller';
import { EstadisticasService } from './estadisticas.service';
import { PdfService } from './pdf/pdf.service';
import { ReportesPdfService } from './reportes-pdf.service';
import { ReportesRepository } from './reportes.repository';

/**
 * Solo lectura y sin tablas propias: estadísticas (y PDF) calculados con consultas directas
 * dentro de una instantánea. Depende de `fundaciones` (guard) y `mascotas` (ficha pública); nadie depende de él.
 */
@Module({
  imports: [FundacionesModule, MascotasModule],
  controllers: [
    EstadisticasFundacionController,
    EstadisticasAdminController,
    FichaPdfController,
    ReportesPdfController,
  ],
  providers: [ReportesRepository, EstadisticasService, PdfService, ReportesPdfService],
})
export class ReportesModule {}
