import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notificacion } from './entities/notificacion.entity';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesRepository } from './notificaciones.repository';
import { NotificacionesService } from './notificaciones.service';

/** Módulo hoja: dueño de `notificacion`; no depende de ningún otro módulo de dominio. */
@Module({
  imports: [TypeOrmModule.forFeature([Notificacion])],
  controllers: [NotificacionesController],
  providers: [NotificacionesRepository, NotificacionesService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
