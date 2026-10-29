import { Module } from '@nestjs/common';
import { DonacionesModule } from '../donaciones/donaciones.module';
import { FundacionesModule } from '../fundaciones/fundaciones.module';
import { MailModule } from '../mail/mail.module';
import { MascotasModule } from '../mascotas/mascotas.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { SeguimientosModule } from '../seguimientos/seguimientos.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AvisosListener } from './avisos.listener';
import { AvisosService } from './avisos.service';
import { EntregaAvisoService } from './entrega-aviso.service';

/**
 * Orquestador sin tablas (como `admin`) y único módulo con listeners de eventos de dominio:
 * decide destinatarios, textos y correo, y crea las notificaciones por `notificaciones`, que
 * permanece como módulo hoja. Nadie lo importa salvo `AppModule`, así que no hay ciclos.
 */
@Module({
  imports: [
    NotificacionesModule,
    DonacionesModule,
    SeguimientosModule,
    MascotasModule,
    FundacionesModule,
    UsuariosModule,
    MailModule,
  ],
  providers: [EntregaAvisoService, AvisosService, AvisosListener],
})
export class AvisosModule {}
