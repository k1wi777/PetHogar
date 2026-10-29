import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogosController } from './catalogos.controller';
import { CatalogosRepository } from './catalogos.repository';
import { CatalogosService } from './catalogos.service';
import { Especie } from './entities/especie.entity';
import { Raza } from './entities/raza.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Especie, Raza])],
  controllers: [CatalogosController],
  providers: [CatalogosRepository, CatalogosService],
  exports: [CatalogosService],
})
export class CatalogosModule {}
