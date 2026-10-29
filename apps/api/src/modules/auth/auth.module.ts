import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FundacionesModule } from '../fundaciones/fundaciones.module';
import { MailModule } from '../mail/mail.module';
import { StorageModule } from '../storage/storage.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AuthController } from './auth.controller';
import { RefreshToken } from './entities/refresh-token.entity';
import { LoginService } from './login.service';
import { PerfilService } from './perfil.service';
import { RecuperacionService } from './recuperacion.service';
import { RefreshTokenRepository } from './refresh-token.repository';
import { RegistroService } from './registro.service';
import { SesionService } from './sesion.service';
import { VerificacionService } from './verificacion.service';

/** Orquesta los casos de uso de autenticación; el JWT lo aporta el `AccesoModule` global. */
@Module({
  imports: [
    TypeOrmModule.forFeature([RefreshToken]),
    UsuariosModule,
    FundacionesModule,
    MailModule,
    StorageModule,
  ],
  controllers: [AuthController],
  providers: [
    RefreshTokenRepository,
    RegistroService,
    VerificacionService,
    LoginService,
    SesionService,
    PerfilService,
    RecuperacionService,
  ],
  exports: [SesionService],
})
export class AuthModule {}
