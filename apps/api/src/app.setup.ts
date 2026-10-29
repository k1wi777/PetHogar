import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { crearValidationPipe } from './common/pipes/validation.pipe';
import type { EnvironmentVariables } from './config/env.validation';
import { servirArchivosPublicos } from './modules/storage/archivos-estaticos';

/** Configuración HTTP común a `main.ts` y a las pruebas que levantan la aplicación real. */
export function configurarApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  app.use(helmet());
  app.setGlobalPrefix('api');
  const origenPermitido = new URL(config.get('FRONTEND_URL', { infer: true })).origin;
  app.enableCors({
    // Otros orígenes no reciben cabeceras CORS.
    origin: (
      origen: string | undefined,
      callback: (err: Error | null, permitido?: string | false) => void,
    ) => callback(null, origen === origenPermitido ? origen : false),
    credentials: true,
  });
  servirArchivosPublicos(app, config.get('UPLOADS_DIR', { infer: true }));
  app.useGlobalPipes(crearValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
}
