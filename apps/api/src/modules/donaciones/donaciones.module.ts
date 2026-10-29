import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FundacionesModule } from '../fundaciones/fundaciones.module';
import { StorageModule } from '../storage/storage.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { ComprobanteService } from './comprobante.service';
import { DonacionesFundacionController } from './donaciones-fundacion.controller';
import { DonacionesController } from './donaciones.controller';
import { DonacionesRepository } from './donaciones.repository';
import { DonacionesService } from './donaciones.service';
import { Donacion } from './entities/donacion.entity';

/**
 * Dueño de `donacion`. Depende de `fundaciones`, `usuarios` y `storage`; no conoce a
 * `notificaciones` ni a `avisos` (que lo consultan), así que no hay ciclos.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Donacion]), FundacionesModule, UsuariosModule, StorageModule],
  controllers: [DonacionesController, DonacionesFundacionController],
  providers: [DonacionesRepository, ComprobanteService, DonacionesService],
  exports: [DonacionesService],
})
export class DonacionesModule {}
