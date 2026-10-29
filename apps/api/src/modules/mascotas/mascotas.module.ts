import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogosModule } from '../catalogos/catalogos.module';
import { FundacionesModule } from '../fundaciones/fundaciones.module';
import { StorageModule } from '../storage/storage.module';
import { CatalogoMascotasRepository } from './catalogo/catalogo-mascotas.repository';
import { CatalogoMascotasService } from './catalogo/catalogo-mascotas.service';
import { MascotasCatalogoController } from './catalogo/mascotas-catalogo.controller';
import { FotoMascota } from './entities/foto-mascota.entity';
import { HistorialMedico } from './entities/historial-medico.entity';
import { Mascota } from './entities/mascota.entity';
import { FotosMascotaRepository } from './fotos/fotos-mascota.repository';
import { FotosMascotaService } from './fotos/fotos-mascota.service';
import { ProcesadorImagenService } from './fotos/procesador-imagen.service';
import { HistorialRepository } from './historial/historial.repository';
import { HistorialService } from './historial/historial.service';
import { MascotasFundacionController } from './mascotas-fundacion.controller';
import { MascotasRepository } from './mascotas.repository';
import { MascotasService } from './mascotas.service';

/**
 * Dueño de `mascota`, `foto_mascota` e `historial_medico`. Dependencias sin ciclos: `catalogos`
 * (validar la raza), `fundaciones` (guard y `@FundacionId()`) y `storage` (fotos).
 * `MascotasService` se exporta para que la Fase 3 (adopciones) cambie el estado con `transicionar`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Mascota, FotoMascota, HistorialMedico]),
    CatalogosModule,
    FundacionesModule,
    StorageModule,
  ],
  controllers: [MascotasCatalogoController, MascotasFundacionController],
  providers: [
    MascotasRepository,
    MascotasService,
    FotosMascotaRepository,
    FotosMascotaService,
    ProcesadorImagenService,
    HistorialRepository,
    HistorialService,
    CatalogoMascotasRepository,
    CatalogoMascotasService,
  ],
  exports: [MascotasService],
})
export class MascotasModule {}
