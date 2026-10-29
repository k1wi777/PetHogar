import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FundacionesModule } from '../fundaciones/fundaciones.module';
import { MascotasModule } from '../mascotas/mascotas.module';
import { StorageModule } from '../storage/storage.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { SolicitudAdopcion } from './entities/solicitud-adopcion.entity';
import { FormularioService } from './formulario.service';
import { SolicitudesAdoptanteController } from './solicitudes-adoptante.controller';
import { SolicitudesFundacionController } from './solicitudes-fundacion.controller';
import { SolicitudesRepository } from './solicitudes.repository';
import { SolicitudesService } from './solicitudes.service';

/**
 * Dueño de `solicitud_adopcion`. Depende de `mascotas`, `usuarios`, `fundaciones` (guard) y
 * `storage`; no conoce a `adopciones` (que depende de él), así que no hay ciclos.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SolicitudAdopcion]),
    MascotasModule,
    UsuariosModule,
    FundacionesModule,
    StorageModule,
  ],
  controllers: [SolicitudesAdoptanteController, SolicitudesFundacionController],
  providers: [SolicitudesRepository, SolicitudesService, FormularioService],
  exports: [SolicitudesService],
})
export class SolicitudesModule {}
