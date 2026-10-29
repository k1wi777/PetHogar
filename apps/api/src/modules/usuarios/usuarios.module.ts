import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Adoptante } from './entities/adoptante.entity';
import { Rol } from './entities/rol.entity';
import { Usuario } from './entities/usuario.entity';
import { UsuariosRepository } from './usuarios.repository';
import { UsuariosService } from './usuarios.service';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Adoptante, Rol])],
  providers: [UsuariosRepository, UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
