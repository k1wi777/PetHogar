import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FundacionesModule } from '../fundaciones/fundaciones.module';
import { StorageModule } from '../storage/storage.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { SeguimientoEvidencia } from './entities/seguimiento-evidencia.entity';
import { Seguimiento } from './entities/seguimiento.entity';
import { EvidenciasService } from './evidencias.service';
import { ReporteService } from './reporte.service';
import { ResultadoService } from './resultado.service';
import { SeguimientosAdoptanteController } from './seguimientos-adoptante.controller';
import { SeguimientosFundacionController } from './seguimientos-fundacion.controller';
import { SeguimientosCronRegistro } from './tareas/seguimientos-cron.registro';
import { SeguimientosTareasService } from './tareas/seguimientos-tareas.service';
import { SeguimientosRepository } from './seguimientos.repository';
import { SeguimientosService } from './seguimientos.service';

/**
 * Dueño de `seguimiento` y `seguimiento_evidencia`. No importa `adopciones`: la propiedad y los
 * datos de la adopción se leen con joins de solo lectura; es `adopciones` quien lo importa para
 * cancelar pendientes y resumir. Depende de `usuarios`, `fundaciones` (guard) y `storage`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Seguimiento, SeguimientoEvidencia]),
    UsuariosModule,
    FundacionesModule,
    StorageModule,
  ],
  controllers: [SeguimientosFundacionController, SeguimientosAdoptanteController],
  providers: [
    SeguimientosRepository,
    SeguimientosService,
    ReporteService,
    ResultadoService,
    EvidenciasService,
    SeguimientosTareasService,
    SeguimientosCronRegistro,
  ],
  exports: [SeguimientosService],
})
export class SeguimientosModule {}
