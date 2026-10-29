import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { crearValidationPipe } from './common/pipes/validation.pipe';
import type { EnvironmentVariables } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  const logger = new Logger('Bootstrap');

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
  app.useGlobalPipes(crearValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());

  const documento = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('PetHogar API')
      .setDescription('API REST de PetHogar')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, documento);

  const puerto = config.get('PORT', { infer: true });
  await app.listen(puerto);
  logger.log(`API disponible en http://localhost:${puerto}/api`);
  logger.log(`Documentación Swagger en http://localhost:${puerto}/api/docs`);
}

void bootstrap();
