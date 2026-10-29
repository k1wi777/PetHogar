import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import {
  AdoptionApproved,
  AdoptionClosed,
  AdoptionRejected,
  AdoptionRequestCreated,
  CATALOGO_EVENTOS,
  DonationRegistered,
  EventosModule,
  FollowUpOverdue,
  FollowUpReminder,
  FollowUpReportReceived,
  FollowUpScheduled,
  FoundationRegistered,
  FoundationValidated,
  WellbeingAlertRaised,
} from '.';

const EVENTOS_DE_EJEMPLO = [
  new FoundationRegistered(1),
  new FoundationValidated(1, 'aprobada', null),
  new AdoptionRequestCreated(2, 3, 1, 4),
  new AdoptionApproved(2, 9, 3, 1, 4),
  new AdoptionRejected(5, 3, 1, 6, 'Otra solicitud fue aprobada', true),
  new AdoptionClosed(9, 'revocada', 3, 1, 4),
  new FollowUpScheduled(7, 9, new Date('2026-12-01T00:00:00Z')),
  new FollowUpReportReceived(7, 9),
  new FollowUpOverdue(7, 9),
  new FollowUpReminder(7, 9, new Date('2026-12-01T05:00:00Z'), 2),
  new WellbeingAlertRaised(7, 9, 3, 1),
  new DonationRegistered(8, 1, null),
];

@Injectable()
class ListenerPrueba {
  readonly recibidos: unknown[] = [];

  @OnEvent(FoundationRegistered.eventName)
  @OnEvent(FoundationValidated.eventName)
  @OnEvent(AdoptionRequestCreated.eventName)
  @OnEvent(AdoptionApproved.eventName)
  @OnEvent(AdoptionRejected.eventName)
  @OnEvent(AdoptionClosed.eventName)
  @OnEvent(FollowUpScheduled.eventName)
  @OnEvent(FollowUpReportReceived.eventName)
  @OnEvent(FollowUpOverdue.eventName)
  @OnEvent(FollowUpReminder.eventName)
  @OnEvent(WellbeingAlertRaised.eventName)
  @OnEvent(DonationRegistered.eventName)
  registrar(evento: unknown): void {
    this.recibidos.push(evento);
  }
}

@Injectable()
class ListenerQueFalla {
  @OnEvent(DonationRegistered.eventName)
  fallar(): void {
    throw new Error('fallo del listener');
  }
}

describe('catálogo de eventos de dominio', () => {
  it('define doce eventos con nombres únicos y constantes', () => {
    const nombres = CATALOGO_EVENTOS.map((clase) => clase.eventName);
    expect(nombres).toHaveLength(12);
    expect(new Set(nombres).size).toBe(12);
    nombres.forEach((nombre) => expect(nombre).toMatch(/^[a-z-]+\.[a-z-]+$/));
  });

  it('los payloads solo contienen identificadores y datos mínimos (sin objetos ni entidades)', () => {
    for (const evento of EVENTOS_DE_EJEMPLO) {
      for (const valor of Object.values(evento)) {
        const permitido =
          valor === null ||
          typeof valor === 'number' ||
          typeof valor === 'string' ||
          typeof valor === 'boolean' ||
          valor instanceof Date;
        expect(permitido).toBe(true);
      }
    }
  });
});

describe('bus de eventos', () => {
  let emitter: EventEmitter2;
  let listener: ListenerPrueba;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const modulo = await Test.createTestingModule({
      imports: [EventosModule],
      providers: [ListenerPrueba, ListenerQueFalla],
    }).compile();
    await modulo.init();
    emitter = modulo.get(EventEmitter2);
    listener = modulo.get(ListenerPrueba);
  });

  afterEach(() => jest.restoreAllMocks());

  it.each(EVENTOS_DE_EJEMPLO.map((e) => [e.constructor.name, e] as const))(
    'entrega %s al listener como instancia de su clase con el payload',
    (_nombre, evento) => {
      const clase = evento.constructor as unknown as { eventName: string };
      emitter.emit(clase.eventName, evento);
      expect(listener.recibidos).toHaveLength(1);
      expect(listener.recibidos[0]).toBeInstanceOf(evento.constructor);
      expect(listener.recibidos[0]).toEqual(evento);
    },
  );

  it('un listener que falla no propaga el error a quien emite', () => {
    const evento = new DonationRegistered(1, 2, 3);
    expect(() => emitter.emit(DonationRegistered.eventName, evento)).not.toThrow();
    expect(listener.recibidos).toHaveLength(1);
  });
});
