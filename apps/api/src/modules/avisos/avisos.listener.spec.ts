import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import {
  AdoptionApproved,
  AdoptionClosed,
  AdoptionRejected,
  AdoptionRequestCreated,
  CATALOGO_EVENTOS,
  DonationRegistered,
  FollowUpOverdue,
  FollowUpReminder,
  FollowUpReportReceived,
  FollowUpScheduled,
  FoundationRegistered,
  FoundationValidated,
  WellbeingAlertRaised,
} from '../../common/events';
import { AvisosListener } from './avisos.listener';
import { AvisosService } from './avisos.service';

/** Evento de ejemplo y método del servicio que debe atenderlo. */
const EJEMPLOS: [object, keyof AvisosService][] = [
  [new FoundationRegistered(1), 'fundacionRegistrada'],
  [new FoundationValidated(1, 'aprobada', null), 'fundacionValidada'],
  [new AdoptionRequestCreated(2, 3, 1, 4), 'solicitudCreada'],
  [new AdoptionApproved(2, 9, 3, 1, 4), 'solicitudAprobada'],
  [new AdoptionRejected(5, 3, 1, 6, 'x', false), 'solicitudRechazada'],
  [new AdoptionClosed(9, 'revocada', 3, 1, 4), 'adopcionCerrada'],
  [new FollowUpScheduled(7, 9, new Date()), 'seguimientoProgramado'],
  [new FollowUpReportReceived(7, 9), 'reporteRecibido'],
  [new FollowUpOverdue(7, 9), 'seguimientoVencido'],
  [new FollowUpReminder(7, 9, new Date(), 2), 'seguimientoPorVencer'],
  [new WellbeingAlertRaised(7, 9, 3, 1), 'alertaBienestar'],
  [new DonationRegistered(8, 1, 4), 'donacionRegistrada'],
];

const METODOS = [...new Set(EJEMPLOS.map(([, metodo]) => metodo))];

describe('AvisosListener', () => {
  let emisor: EventEmitter2;
  const avisos = Object.fromEntries(METODOS.map((m) => [m, jest.fn()])) as Record<
    keyof AvisosService,
    jest.Mock
  >;
  let error: jest.SpyInstance;
  let noManejados: unknown[];
  const alRechazar = (motivo: unknown): number => noManejados.push(motivo);

  beforeEach(async () => {
    jest.resetAllMocks();
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    for (const mock of Object.values(avisos)) mock.mockResolvedValue(undefined);
    noManejados = [];
    process.on('unhandledRejection', alRechazar);
    const modulo = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot({ wildcard: false })],
      providers: [AvisosListener, { provide: AvisosService, useValue: avisos }],
    }).compile();
    await modulo.init();
    emisor = modulo.get(EventEmitter2);
  });

  afterEach(() => {
    process.off('unhandledRejection', alRechazar);
    jest.restoreAllMocks();
  });

  it('cada clase del catálogo tiene un ejemplo y por tanto un listener que lo atiende', () => {
    const cubiertas = EJEMPLOS.map(([evento]) => evento.constructor);
    for (const clase of CATALOGO_EVENTOS) expect(cubiertas).toContain(clase);
    expect(EJEMPLOS).toHaveLength(CATALOGO_EVENTOS.length);
  });

  it.each(EJEMPLOS.map(([evento, metodo]) => [evento.constructor.name, evento, metodo] as const))(
    '%s llega al método %s del servicio con el mismo evento',
    async (_nombre, evento, metodo) => {
      const clase = evento.constructor as unknown as { eventName: string };
      await emisor.emitAsync(clase.eventName, evento);
      expect(avisos[metodo]).toHaveBeenCalledTimes(1);
      expect(avisos[metodo]).toHaveBeenCalledWith(evento);
      for (const otro of METODOS.filter((m) => m !== metodo)) {
        expect(avisos[otro]).not.toHaveBeenCalled();
      }
    },
  );

  it.each(EJEMPLOS.map(([evento, metodo]) => [evento.constructor.name, evento, metodo] as const))(
    '%s: si el servicio rechaza, lo registra, no propaga y no deja un rechazo sin manejar',
    async (_nombre, evento, metodo) => {
      avisos[metodo].mockRejectedValue(new Error('fallo del aviso'));
      const clase = evento.constructor as unknown as { eventName: string };
      expect(() => emisor.emit(clase.eventName, evento)).not.toThrow();
      await new Promise((resolver) => setImmediate(resolver));
      await new Promise((resolver) => setImmediate(resolver));
      expect(error).toHaveBeenCalledWith(expect.stringContaining('fallo del aviso'));
      expect(noManejados).toEqual([]);
    },
  );

  it('un fallo síncrono del servicio tampoco llega al emisor', async () => {
    avisos.solicitudAprobada.mockImplementation(() => {
      throw new Error('boom síncrono');
    });
    const evento = new AdoptionApproved(2, 9, 3, 1, 4);
    expect(() => emisor.emit(AdoptionApproved.eventName, evento)).not.toThrow();
    await new Promise((resolver) => setImmediate(resolver));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('boom síncrono'));
    expect(noManejados).toEqual([]);
  });
});
