import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { StorageModule } from '../storage/storage.module';
import { PruebasController } from './pruebas.controller';
import { EndpointsPruebaGuard } from './endpoints-prueba.guard';

@Module({
  imports: [StorageModule, MailModule],
  controllers: [PruebasController],
  providers: [EndpointsPruebaGuard],
})
export class PruebasModule {}
