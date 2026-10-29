import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configurarApp } from './app.setup';
import type { EnvironmentVariables } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  const logger = new Logger('Bootstrap');

  configurarApp(app);

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
