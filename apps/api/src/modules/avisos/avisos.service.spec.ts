import { Logger } from '@nestjs/common';
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
import { EstadoValidacion } from '../fundaciones/entities/fundacion.enum';
import { AvisosService } from './avisos.service';

const FUNDACION = {
  id: 3,
  nombre: 'Huellas',
  usuarioId: 20,
  estadoValidacion: EstadoValidacion.Aprobada,
};
const SEGUIMIENTO = {
  tipo: 'visita',
  fechaProgramada: '2026-11-05',
  adopcionId: 9,
  mascotaNombre: 'Luna',
  fundacionId: 3,
  fundacionNombre: 'Huellas',
  fundacionUsuarioId: 20,
  adoptanteUsuarioId: 30,
  // Lo que nunca debe llegar a un aviso, aunque el origen lo trajera.
  estadoBienestar: 'malo',
  observaciones: 'OBSERVACION-PRIVADA',
};

function crear() {
  const entrega = { entregar: jest.fn().mockResolvedValue(undefined) };
  const usuarios = { usuarioIdDeAdoptante: jest.fn(), idsAdministradoresActivos: jest.fn() };
  const fundaciones = { datosBasicos: jest.fn() };
  const mascotas = { nombrePorId: jest.fn() };
  const seguimientos = { datosParaAviso: jest.fn() };
  const donaciones = { datosParaAviso: jest.fn() };
  usuarios.usuarioIdDeAdoptante.mockResolvedValue(30);
  usuarios.idsAdministradoresActivos.mockResolvedValue([1, 2]);
  fundaciones.datosBasicos.mockResolvedValue(FUNDACION);
  mascotas.nombrePorId.mockResolvedValue('Luna');
  seguimientos.datosParaAviso.mockResolvedValue(SEGUIMIENTO);
  donaciones.datosParaAviso.mockResolvedValue({
    tipo: 'economica',
    monto: '50000.00',
    descripcionEspecie: null,
    fecha: new Date('2026-10-29T15:00:00Z'),
    usuarioId: 9,
  });
  const service = new AvisosService(
    entrega as never,
    usuarios as never,
    fundaciones as never,
    mascotas as never,
    seguimientos as never,
    donaciones as never,
  );
  return { service, entrega, usuarios, fundaciones, mascotas, seguimientos, donaciones };
}

/** [destinatario, aviso, opciones] de cada llamada. */
const destinatarios = (entrega: { entregar: jest.Mock }): number[] =>
  entrega.entregar.mock.calls.map((c) => c[0] as number);

describe('AvisosService', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  describe('fundaciones', () => {
    it('FoundationRegistered: a todos los administradores activos, sin correo', async () => {
      const { service, entrega } = crear();
      await service.fundacionRegistrada(new FoundationRegistered(3));
      expect(destinatarios(entrega)).toEqual([1, 2]);
      expect(entrega.entregar.mock.calls[0][1]).toMatchObject({
        clave: 'foundation.registered:3',
        referencia: { tipo: 'fundacion', id: 3 },
      });
      expect(entrega.entregar.mock.calls[0][2]).toBeUndefined();
    });

    it('con varios administradores, uno que falla no impide los demás ni propaga', async () => {
      const { service, entrega, usuarios } = crear();
      usuarios.idsAdministradoresActivos.mockResolvedValue([1, 2, 3]);
      entrega.entregar.mockImplementation((id: number) =>
        id === 2 ? Promise.reject(new Error('boom')) : Promise.resolve(),
      );
      await expect(
        service.fundacionRegistrada(new FoundationRegistered(3)),
      ).resolves.toBeUndefined();
      expect(destinatarios(entrega)).toEqual([1, 2, 3]);
    });

    it('sin administradores activos no entrega nada', async () => {
      const { service, entrega, usuarios } = crear();
      usuarios.idsAdministradoresActivos.mockResolvedValue([]);
      await service.fundacionRegistrada(new FoundationRegistered(3));
      expect(entrega.entregar).not.toHaveBeenCalled();
    });

    it.each(['aprobada', 'rechazada'] as const)(
      'FoundationValidated (%s): al usuario de la fundación, con correo y su nombre',
      async (decision) => {
        const { service, entrega } = crear();
        await service.fundacionValidada(new FoundationValidated(3, decision, 'Falta RUT'));
        const [usuarioId, aviso, opciones] = entrega.entregar.mock.calls[0];
        expect(usuarioId).toBe(20);
        expect(aviso.clave).toBe(`foundation.validated:3:${decision}`);
        expect(opciones).toEqual({ correo: { plantilla: 'notificacion' }, nombre: 'Huellas' });
      },
    );

    it('si la fundación no existe omite el aviso sin lanzar', async () => {
      const { service, entrega, fundaciones } = crear();
      fundaciones.datosBasicos.mockResolvedValue(null);
      await expect(
        service.fundacionValidada(new FoundationValidated(3, 'aprobada', null)),
      ).resolves.toBeUndefined();
      await expect(
        service.fundacionRegistrada(new FoundationRegistered(3)),
      ).resolves.toBeUndefined();
      expect(entrega.entregar).not.toHaveBeenCalled();
      expect(Logger.prototype.warn).toHaveBeenCalled();
    });
  });

  describe('solicitudes y adopciones', () => {
    it('AdoptionRequestCreated: al usuario de la fundación, sin correo y sin nombre del adoptante', async () => {
      const { service, entrega } = crear();
      await service.solicitudCreada(new AdoptionRequestCreated(5, 4, 3, 8));
      const [usuarioId, aviso, opciones] = entrega.entregar.mock.calls[0];
      expect(usuarioId).toBe(20);
      expect(aviso.mensaje).toBe('Nueva solicitud para Luna.');
      expect(opciones).toBeUndefined();
    });

    it('AdoptionApproved: al ADOPTANTE (no a la fundación), con correo', async () => {
      const { service, entrega, usuarios } = crear();
      await service.solicitudAprobada(new AdoptionApproved(5, 9, 4, 3, 8));
      expect(usuarios.usuarioIdDeAdoptante).toHaveBeenCalledWith(8);
      expect(destinatarios(entrega)).toEqual([30]);
      expect(destinatarios(entrega)).not.toContain(20);
      expect(entrega.entregar.mock.calls[0][1]).toMatchObject({
        clave: 'adoption.approved:5',
        referencia: { tipo: 'solicitud', id: 5 },
      });
      expect(entrega.entregar.mock.calls[0][2]).toEqual({ correo: { plantilla: 'notificacion' } });
    });

    it('AdoptionRejected: al adoptante con su observación; el rechazo automático no usa la observación', async () => {
      const { service, entrega } = crear();
      await service.solicitudRechazada(
        new AdoptionRejected(5, 4, 3, 8, 'No cumple el perfil', false),
      );
      await service.solicitudRechazada(new AdoptionRejected(6, 4, 3, 9, 'interna', true));
      expect(destinatarios(entrega)).toEqual([30, 30]);
      expect(entrega.entregar.mock.calls[0][1].mensaje).toContain('No cumple el perfil');
      expect(entrega.entregar.mock.calls[1][1].mensaje).toContain('ya fue adoptada');
      expect(entrega.entregar.mock.calls[1][1].mensaje).not.toContain('interna');
      expect(entrega.entregar.mock.calls[0][2]).toEqual({ correo: { plantilla: 'notificacion' } });
    });

    it('AdoptionClosed: al adoptante, sin correo y sin motivo', async () => {
      const { service, entrega } = crear();
      await service.adopcionCerrada(new AdoptionClosed(9, 'revocada', 4, 3, 8));
      expect(destinatarios(entrega)).toEqual([30]);
      expect(entrega.entregar.mock.calls[0][2]).toBeUndefined();
      expect(entrega.entregar.mock.calls[0][1]).toMatchObject({
        tipo: 'adopcion',
        clave: 'adoption.closed:9',
      });
    });

    it('si falta el adoptante o la mascota omite el aviso', async () => {
      const { service, entrega, usuarios, mascotas } = crear();
      usuarios.usuarioIdDeAdoptante.mockResolvedValueOnce(null);
      await service.solicitudAprobada(new AdoptionApproved(5, 9, 4, 3, 8));
      mascotas.nombrePorId.mockResolvedValueOnce(null);
      await service.solicitudRechazada(new AdoptionRejected(5, 4, 3, 8, null, false));
      expect(entrega.entregar).not.toHaveBeenCalled();
    });
  });

  describe('seguimientos', () => {
    it('FollowUpScheduled: al adoptante con correo', async () => {
      const { service, entrega } = crear();
      await service.seguimientoProgramado(new FollowUpScheduled(7, 9, new Date()));
      const [usuarioId, aviso, opciones] = entrega.entregar.mock.calls[0];
      expect(usuarioId).toBe(30);
      expect(aviso.mensaje).toBe(
        'Huellas programó una visita para Luna el 5 de noviembre de 2026.',
      );
      expect(opciones).toEqual({ correo: { plantilla: 'notificacion' } });
    });

    it('FollowUpReminder: al adoptante con correo y los días restantes del evento', async () => {
      const { service, entrega } = crear();
      await service.seguimientoPorVencer(new FollowUpReminder(7, 9, new Date(), 1));
      expect(destinatarios(entrega)).toEqual([30]);
      expect(entrega.entregar.mock.calls[0][1].mensaje).toContain('vence mañana');
      expect(entrega.entregar.mock.calls[0][2]).toEqual({ correo: { plantilla: 'notificacion' } });
    });

    it('FollowUpOverdue: adoptante con correo y fundación solo con campana', async () => {
      const { service, entrega } = crear();
      await service.seguimientoVencido(new FollowUpOverdue(7, 9));
      const porUsuario = new Map(entrega.entregar.mock.calls.map((c) => [c[0], c]));
      expect(porUsuario.get(30)?.[1].mensaje).toContain('Envía tu reporte');
      expect(porUsuario.get(30)?.[2]).toEqual({ correo: { plantilla: 'notificacion' } });
      expect(porUsuario.get(20)?.[1].mensaje).toBe('Seguimiento vencido de Luna.');
      expect(porUsuario.get(20)?.[2]).toBeUndefined();
    });

    it('FollowUpOverdue: si falla la entrega a uno, la otra se intenta y no se propaga', async () => {
      const { service, entrega } = crear();
      entrega.entregar.mockImplementation((id: number) =>
        id === 30 ? Promise.reject(new Error('boom')) : Promise.resolve(),
      );
      await expect(service.seguimientoVencido(new FollowUpOverdue(7, 9))).resolves.toBeUndefined();
      expect(destinatarios(entrega).sort((a, b) => a - b)).toEqual([20, 30]);
    });

    it('FollowUpReportReceived: a la fundación, sin correo', async () => {
      const { service, entrega } = crear();
      await service.reporteRecibido(new FollowUpReportReceived(7, 9));
      expect(destinatarios(entrega)).toEqual([20]);
      expect(entrega.entregar.mock.calls[0][2]).toBeUndefined();
    });

    it('WellbeingAlertRaised: a la fundación y a TODOS los administradores, sin bienestar ni observaciones', async () => {
      const { service, entrega } = crear();
      await service.alertaBienestar(new WellbeingAlertRaised(7, 9, 4, 3));
      expect(destinatarios(entrega).sort((a, b) => a - b)).toEqual([1, 2, 20]);
      expect(entrega.entregar.mock.calls.every((c) => c[2] === undefined)).toBe(true);
      const admin = entrega.entregar.mock.calls.find((c) => c[0] === 1)?.[1];
      expect(admin.referencia).toEqual({ tipo: 'fundacion', id: 3 });
      const todo = JSON.stringify(entrega.entregar.mock.calls);
      expect(todo).not.toMatch(/OBSERVACION-PRIVADA|malo|estadoBienestar/);
    });

    it('si el seguimiento ya no existe omite el aviso', async () => {
      const { service, entrega, seguimientos } = crear();
      seguimientos.datosParaAviso.mockResolvedValue(null);
      await service.seguimientoProgramado(new FollowUpScheduled(7, 9, new Date()));
      await service.seguimientoPorVencer(new FollowUpReminder(7, 9, new Date(), 1));
      await service.seguimientoVencido(new FollowUpOverdue(7, 9));
      await service.reporteRecibido(new FollowUpReportReceived(7, 9));
      await service.alertaBienestar(new WellbeingAlertRaised(7, 9, 4, 3));
      expect(entrega.entregar).not.toHaveBeenCalled();
    });
  });

  describe('donaciones', () => {
    it('DonationRegistered: notifica a la fundación (sin correo) y confirma al donante por correo', async () => {
      const { service, entrega } = crear();
      await service.donacionRegistrada(new DonationRegistered(8, 3, 9));
      const porUsuario = new Map(entrega.entregar.mock.calls.map((c) => [c[0], c]));
      expect([...porUsuario.keys()].sort((a, b) => a - b)).toEqual([9, 20]);
      expect(porUsuario.get(20)?.[1].mensaje).toBe(
        'Recibiste una donación económica de $ 50.000 COP.',
      );
      expect(porUsuario.get(20)?.[2]).toBeUndefined();
      expect(porUsuario.get(9)?.[2]).toEqual({
        correo: {
          plantilla: 'donacion-confirmacion',
          fundacion: 'Huellas',
          detalle: 'Donación económica de $ 50.000 COP',
          fecha: '29 de octubre de 2026',
        },
      });
      // Nada del donante en el aviso a la fundación.
      expect(JSON.stringify(porUsuario.get(20))).not.toMatch(/Ana|@/);
    });

    it('sin usuario donante solo se notifica a la fundación', async () => {
      const { service, entrega } = crear();
      await service.donacionRegistrada(new DonationRegistered(8, 3, null));
      expect(destinatarios(entrega)).toEqual([20]);
    });

    it('si falta la donación o la fundación omite el aviso', async () => {
      const { service, entrega, donaciones } = crear();
      donaciones.datosParaAviso.mockResolvedValue(null);
      await service.donacionRegistrada(new DonationRegistered(8, 3, 9));
      expect(entrega.entregar).not.toHaveBeenCalled();
    });
  });
});
