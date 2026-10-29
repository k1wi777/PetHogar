import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  AdoptionApproved,
  AdoptionClosed,
  AdoptionRejected,
  AdoptionRequestCreated,
  DonationRegistered,
  FollowUpOverdue,
  FollowUpReminder,
  FollowUpReportReceived,
  FollowUpScheduled,
  FoundationRegistered,
  FoundationValidated,
  WellbeingAlertRaised,
} from '../../common/events';
import { AvisosService } from './avisos.service';

/**
 * Único módulo con listeners del catálogo de eventos: un método por evento, delgado. `emit` no
 * espera a los listeners (la respuesta HTTP no depende de ellos) y `emitirSeguro` solo atrapa
 * errores síncronos, así que cada método captura todo: un rechazo asíncrono quedaría sin manejar.
 */
@Injectable()
export class AvisosListener {
  private readonly logger = new Logger(AvisosListener.name);

  constructor(private readonly avisos: AvisosService) {}

  @OnEvent(FoundationRegistered.eventName)
  alRegistrarseFundacion(evento: FoundationRegistered): Promise<void> {
    return this.ejecutar(FoundationRegistered.eventName, () =>
      this.avisos.fundacionRegistrada(evento),
    );
  }

  @OnEvent(FoundationValidated.eventName)
  alValidarseFundacion(evento: FoundationValidated): Promise<void> {
    return this.ejecutar(FoundationValidated.eventName, () =>
      this.avisos.fundacionValidada(evento),
    );
  }

  @OnEvent(AdoptionRequestCreated.eventName)
  alCrearseSolicitud(evento: AdoptionRequestCreated): Promise<void> {
    return this.ejecutar(AdoptionRequestCreated.eventName, () =>
      this.avisos.solicitudCreada(evento),
    );
  }

  @OnEvent(AdoptionApproved.eventName)
  alAprobarseSolicitud(evento: AdoptionApproved): Promise<void> {
    return this.ejecutar(AdoptionApproved.eventName, () => this.avisos.solicitudAprobada(evento));
  }

  @OnEvent(AdoptionRejected.eventName)
  alRechazarseSolicitud(evento: AdoptionRejected): Promise<void> {
    return this.ejecutar(AdoptionRejected.eventName, () => this.avisos.solicitudRechazada(evento));
  }

  @OnEvent(AdoptionClosed.eventName)
  alCerrarseAdopcion(evento: AdoptionClosed): Promise<void> {
    return this.ejecutar(AdoptionClosed.eventName, () => this.avisos.adopcionCerrada(evento));
  }

  @OnEvent(FollowUpScheduled.eventName)
  alProgramarseSeguimiento(evento: FollowUpScheduled): Promise<void> {
    return this.ejecutar(FollowUpScheduled.eventName, () =>
      this.avisos.seguimientoProgramado(evento),
    );
  }

  @OnEvent(FollowUpReminder.eventName)
  alRecordarseSeguimiento(evento: FollowUpReminder): Promise<void> {
    return this.ejecutar(FollowUpReminder.eventName, () =>
      this.avisos.seguimientoPorVencer(evento),
    );
  }

  @OnEvent(FollowUpOverdue.eventName)
  alVencerSeguimiento(evento: FollowUpOverdue): Promise<void> {
    return this.ejecutar(FollowUpOverdue.eventName, () => this.avisos.seguimientoVencido(evento));
  }

  @OnEvent(FollowUpReportReceived.eventName)
  alRecibirseReporte(evento: FollowUpReportReceived): Promise<void> {
    return this.ejecutar(FollowUpReportReceived.eventName, () =>
      this.avisos.reporteRecibido(evento),
    );
  }

  @OnEvent(WellbeingAlertRaised.eventName)
  alLevantarseAlerta(evento: WellbeingAlertRaised): Promise<void> {
    return this.ejecutar(WellbeingAlertRaised.eventName, () => this.avisos.alertaBienestar(evento));
  }

  @OnEvent(DonationRegistered.eventName)
  alRegistrarseDonacion(evento: DonationRegistered): Promise<void> {
    return this.ejecutar(DonationRegistered.eventName, () =>
      this.avisos.donacionRegistrada(evento),
    );
  }

  /** Nunca rechaza: un fallo se registra y no afecta al emisor ni a los demás listeners. */
  private async ejecutar(evento: string, trabajo: () => Promise<void>): Promise<void> {
    try {
      await trabajo();
    } catch (error) {
      this.logger.error(
        `Falló el aviso de ${evento}: ${error instanceof Error ? error.message : 'error desconocido'}`,
      );
    }
  }
}
