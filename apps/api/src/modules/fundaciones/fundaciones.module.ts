import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Fundacion } from './entities/fundacion.entity';
import { FundacionesRepository } from './fundaciones.repository';
import { FundacionesService } from './fundaciones.service';
import { ApprovedFoundationGuard } from './guards/approved-foundation.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Fundacion])],
  providers: [FundacionesRepository, FundacionesService, ApprovedFoundationGuard],
  exports: [FundacionesService, ApprovedFoundationGuard],
})
export class FundacionesModule {}
