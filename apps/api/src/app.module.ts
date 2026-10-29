import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvironmentVariables, validate } from './config/env.validation';
import { crearOpcionesTypeOrm } from './database/typeorm.options';
import { HealthModule } from './modules/health/health.module';

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
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
