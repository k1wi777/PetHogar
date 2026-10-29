import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FundacionesModule } from '../fundaciones/fundaciones.module';
import { StorageModule } from '../storage/storage.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AdminUsuariosController } from './admin-usuarios.controller';
import { AdminUsuariosService } from './admin-usuarios.service';
import { AdminFundacionesController } from './admin-fundaciones.controller';
import { AdminFundacionesService } from './admin-fundaciones.service';

/** Orquestador sin tablas propias: combina los services de usuarios, fundaciones, auth y storage. */
@Module({
  imports: [UsuariosModule, FundacionesModule, StorageModule, AuthModule],
  controllers: [AdminFundacionesController, AdminUsuariosController],
  providers: [AdminFundacionesService, AdminUsuariosService],
})
export class AdminModule {}
