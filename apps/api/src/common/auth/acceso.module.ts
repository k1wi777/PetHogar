import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { EnvironmentVariables } from '../../config/env.validation';

/** Firma y verificación del access token (HS256); global para que lo use el guard de `AppModule`. */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.get('JWT_ACCESS_EXPIRES_MIN', { infer: true }) * 60,
        },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  exports: [JwtModule],
})
export class AccesoModule {}
