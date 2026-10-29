import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccesoModule } from './common/auth/acceso.module';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { InstantaneaModule } from './common/database/instantanea.module';
import { EventosModule } from './common/events';
import { RelojModule } from './common/reloj/reloj.module';
import { EnvironmentVariables, validate } from './config/env.validation';
import { crearOpcionesTypeOrm } from './database/typeorm.options';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';
import { AdopcionesModule } from './modules/adopciones/adopciones.module';
import { AvisosModule } from './modules/avisos/avisos.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogosModule } from './modules/catalogos/catalogos.module';
import { DonacionesModule } from './modules/donaciones/donaciones.module';
import { FundacionesModule } from './modules/fundaciones/fundaciones.module';
import { MascotasModule } from './modules/mascotas/mascotas.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { SeguimientosModule } from './modules/seguimientos/seguimientos.module';
import { SolicitudesModule } from './modules/solicitudes/solicitudes.module';
import { CuentaActivaGuard } from './modules/usuarios/guards/cuenta-activa.guard';
import { UsuariosModule } from './modules/usuarios/usuarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        ...crearOpcionesTypeOrm({
          DATABASE_HOST: config.get('DATABASE_HOST', { infer: true }),
          DATABASE_PORT: config.get('DATABASE_PORT', { infer: true }),
          DATABASE_USER: config.get('DATABASE_USER', { infer: true }),
          DATABASE_PASSWORD: config.get('DATABASE_PASSWORD', { infer: true }),
          DATABASE_NAME: config.get('DATABASE_NAME', { infer: true }),
        }),
        autoLoadEntities: true,
      }),
    }),
    EventosModule,
    RelojModule,
    InstantaneaModule,
    // Sin decoradores @Cron: los jobs de seguimientos se registran por código según la configuración.
    ScheduleModule.forRoot(),
    AccesoModule,
    HealthModule,
    UsuariosModule,
    FundacionesModule,
    AuthModule,
    AdminModule,
    CatalogosModule,
    MascotasModule,
    SolicitudesModule,
    SeguimientosModule,
    AdopcionesModule,
    DonacionesModule,
    NotificacionesModule,
    AvisosModule,
    ReportesModule,
  ],
  // El orden es el de ejecución: primero el límite de peticiones (también para anónimos),
  // luego la autenticación, la cuenta activa y por último los roles.
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: CuentaActivaGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
