import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation';
import { LocalStorageService } from './local-storage.service';
import { STORAGE_SERVICE } from './storage.interface';

/** Para cambiar a S3/Cloudinary basta otra clase aquí; el dominio solo usa STORAGE_SERVICE. */
@Module({
  providers: [
    {
      provide: STORAGE_SERVICE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        new LocalStorageService({
          directorio: config.get('UPLOADS_DIR', { infer: true }),
          urlBase:
            config.get('API_PUBLIC_URL', { infer: true }) ??
            `http://localhost:${config.get('PORT', { infer: true })}`,
        }),
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
