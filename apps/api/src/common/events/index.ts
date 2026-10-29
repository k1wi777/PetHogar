import {
  AdoptionApproved,
  AdoptionClosed,
  AdoptionRejected,
  AdoptionRequestCreated,
} from './adopcion.events';
import { DonationRegistered } from './donacion.events';
import { FoundationRegistered, FoundationValidated } from './fundacion.events';
import {
  FollowUpOverdue,
  FollowUpReminder,
  FollowUpReportReceived,
  FollowUpScheduled,
  WellbeingAlertRaised,
} from './seguimiento.events';

export * from './adopcion.events';
export * from './donacion.events';
export * from './eventos.module';
export * from './fundacion.events';
export * from './seguimiento.events';

/** Catálogo completo de eventos de dominio. */
export const CATALOGO_EVENTOS = [
  FoundationRegistered,
  FoundationValidated,
  AdoptionRequestCreated,
  AdoptionApproved,
  AdoptionRejected,
  AdoptionClosed,
  FollowUpScheduled,
  FollowUpReportReceived,
  FollowUpOverdue,
  FollowUpReminder,
  WellbeingAlertRaised,
  DonationRegistered,
] as const;
