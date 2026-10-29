import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FundacionesModule } from '../fundaciones/fundaciones.module';
import { MascotasModule } from '../mascotas/mascotas.module';
import { SolicitudesModule } from '../solicitudes/solicitudes.module';
import { StorageModule } from '../storage/storage.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AdopcionesAdoptanteController } from './adopciones-adoptante.controller';
import { AdopcionesFundacionController } from './adopciones-fundacion.controller';
import { AdopcionesRepository } from './adopciones.repository';
import { AdopcionesService } from './adopciones.service';
import { AprobacionService } from './aprobacion.service';
import { DecisionController } from './decision.controller';
import { Adopcion } from './entities/adopcion.entity';

/**
 * Dueño de `adopcion` y orquestador de la aprobación. Depende de `solicitudes` (de donde nace
 * la adopción), `mascotas`, `usuarios`, `fundaciones` (guard) y `storage`; ninguno depende de él.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Adopcion]),
    SolicitudesModule,
    MascotasModule,
    UsuariosModule,
    FundacionesModule,
    StorageModule,
  ],
  controllers: [DecisionController, AdopcionesAdoptanteController, AdopcionesFundacionController],
  providers: [AdopcionesRepository, AdopcionesService, AprobacionService],
})
export class AdopcionesModule {}
