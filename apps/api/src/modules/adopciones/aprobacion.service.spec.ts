import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { AdoptionApproved, AdoptionRejected } from '../../common/events';
import { EstadoMascota } from '../mascotas/entities/mascota.enum';
import { OBSERVACION_AUTOMATICA } from '../solicitudes/solicitudes.service';
import { AprobacionService } from './aprobacion.service';
import { DecisionSolicitudDto, TipoDecision } from './dto/decision-solicitud.dto';

const MANAGER = { id: 'manager' } as never;
const APROBAR = {
  decision: TipoDecision.Aprobar,
  fechaEntrega: '2026-12-01',
} as DecisionSolicitudDto;
const DETALLE = { id: 11, estado: 'aprobada' };

describe('AprobacionService', () => {
  const llamadas: string[] = [];
  const commit = jest.fn();
  const dataSource = {
    // Simula la transacción: si el trabajo lanza, no hay commit (rollback).
    transaction: jest.fn(async (trabajo: (m: unknown) => Promise<unknown>) => {
      llamadas.push('BEGIN');
      const r = await trabajo(MANAGER);
      commit();
      llamadas.push('COMMIT');
      return r;
    }),
  };
  const solicitudes = {
    aprobar: jest.fn(),
    rechazarPendientesDeMascota: jest.fn(),
    rechazar: jest.fn(),
    obtenerDeFundacion: jest.fn(),
  };
  const mascotas = { bloquearParaDecision: jest.fn(), transicionar: jest.fn() };
  const adopciones = { crear: jest.fn() };
  const eventos = { emit: jest.fn() };
  const service = new AprobacionService(
    dataSource as never,
    solicitudes as never,
    mascotas as never,
    adopciones as never,
    eventos as never,
  );

  const registrar =
    <T>(nombre: string, valor: T) =>
    (): Promise<T> => {
      llamadas.push(nombre);
      return Promise.resolve(valor);
    };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    llamadas.length = 0;
    dataSource.transaction.mockImplementation(async (trabajo: (m: unknown) => Promise<unknown>) => {
      llamadas.push('BEGIN');
      const r = await trabajo(MANAGER);
      commit();
      llamadas.push('COMMIT');
      return r;
    });
    mascotas.bloquearParaDecision.mockImplementation(registrar('1-bloquear', 7));
    solicitudes.aprobar.mockImplementation(
      registrar('2-aprobar', { id: 11, mascotaId: 7, adoptanteId: 4 }),
    );
    mascotas.transicionar.mockImplementation(registrar('3-mascota', undefined));
    adopciones.crear.mockImplementation(registrar('4-adopcion', 55));
    solicitudes.rechazarPendientesDeMascota.mockImplementation(
      registrar('5-rechazar', [
        { id: 12, adoptanteId: 5 },
        { id: 13, adoptanteId: 6 },
      ]),
    );
    solicitudes.obtenerDeFundacion.mockResolvedValue(DETALLE);
    eventos.emit.mockImplementation(() => {
      llamadas.push('EVENTO');
    });
  });

  describe('aprobar', () => {
    it('ejecuta los cinco pasos en orden dentro de una sola transacción, con el mismo manager', async () => {
      await service.decidir(11, 3, APROBAR);
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(llamadas.slice(0, 7)).toEqual([
        'BEGIN',
        '1-bloquear',
        '2-aprobar',
        '3-mascota',
        '4-adopcion',
        '5-rechazar',
        'COMMIT',
      ]);
      expect(mascotas.bloquearParaDecision).toHaveBeenCalledWith(MANAGER, 11, 3);
      expect(solicitudes.aprobar).toHaveBeenCalledWith(11, 3, null, MANAGER);
      expect(mascotas.transicionar).toHaveBeenCalledWith(7, EstadoMascota.Adoptada, 'adopcion', {
        manager: MANAGER,
      });
      expect(adopciones.crear).toHaveBeenCalledWith(11, '2026-12-01', MANAGER);
      expect(solicitudes.rechazarPendientesDeMascota).toHaveBeenCalledWith(7, MANAGER);
    });

    it('emite los eventos solo tras el commit: aprobada una vez y un rechazo automático por cada una', async () => {
      const r = await service.decidir(11, 3, { ...APROBAR, observacion: 'Bienvenida' });
      expect(llamadas.slice(6)).toEqual(['COMMIT', 'EVENTO', 'EVENTO', 'EVENTO']);
      expect(eventos.emit.mock.calls).toEqual([
        [AdoptionApproved.eventName, new AdoptionApproved(11, 55, 7, 3, 4)],
        [
          AdoptionRejected.eventName,
          new AdoptionRejected(12, 7, 3, 5, OBSERVACION_AUTOMATICA, true),
        ],
        [
          AdoptionRejected.eventName,
          new AdoptionRejected(13, 7, 3, 6, OBSERVACION_AUTOMATICA, true),
        ],
      ]);
      expect(solicitudes.aprobar).toHaveBeenCalledWith(11, 3, 'Bienvenida', MANAGER);
      expect(r).toEqual({
        solicitud: DETALLE,
        adopcion: { id: 55, fechaEntrega: '2026-12-01', estado: 'activa' },
      });
    });

    it('sin otras pendientes solo se emite AdoptionApproved', async () => {
      solicitudes.rechazarPendientesDeMascota.mockResolvedValue([]);
      await service.decidir(11, 3, APROBAR);
      expect(eventos.emit).toHaveBeenCalledTimes(1);
      expect(eventos.emit.mock.calls[0][0]).toBe(AdoptionApproved.eventName);
    });

    it.each([
      [
        '1 bloquear (ajena o inexistente)',
        mascotas.bloquearParaDecision,
        new NotFoundException('La solicitud no existe'),
      ],
      [
        '2 solicitud ya decidida',
        solicitudes.aprobar,
        new ConflictException('La solicitud ya está rechazada'),
      ],
      [
        '3 mascota no disponible',
        mascotas.transicionar,
        new ConflictException('La mascota no admite'),
      ],
      ['4 crear adopción', adopciones.crear, new Error('violación de uq_adopcion_solicitud')],
      [
        '5 rechazar las demás',
        solicitudes.rechazarPendientesDeMascota,
        new Error('fallo al rechazar'),
      ],
    ])(
      'fallo en el paso %s: se propaga, no hay commit y NO se emite ningún evento',
      async (_n, paso, error) => {
        (paso as jest.Mock).mockRejectedValue(error);
        await expect(service.decidir(11, 3, APROBAR)).rejects.toBe(error);
        expect(commit).not.toHaveBeenCalled();
        expect(llamadas).not.toContain('COMMIT');
        expect(eventos.emit).not.toHaveBeenCalled();
        expect(solicitudes.obtenerDeFundacion).not.toHaveBeenCalled();
      },
    );

    it('un fallo en el paso 2 no ejecuta los pasos siguientes', async () => {
      solicitudes.aprobar.mockRejectedValue(new ConflictException('ya decidida'));
      await expect(service.decidir(11, 3, APROBAR)).rejects.toBeInstanceOf(ConflictException);
      expect(mascotas.transicionar).not.toHaveBeenCalled();
      expect(adopciones.crear).not.toHaveBeenCalled();
      expect(solicitudes.rechazarPendientesDeMascota).not.toHaveBeenCalled();
    });

    it('un listener que lanza no rompe la respuesta ni impide los demás eventos', async () => {
      eventos.emit.mockImplementationOnce(() => {
        throw new Error('listener roto');
      });
      const r = await service.decidir(11, 3, APROBAR);
      expect(eventos.emit).toHaveBeenCalledTimes(3);
      expect(r.adopcion).toMatchObject({ id: 55 });
    });
  });

  describe('rechazar', () => {
    it('delega en solicitudes (sin transacción propia) y no crea adopción', async () => {
      solicitudes.rechazar.mockResolvedValue(DETALLE);
      const r = await service.decidir(11, 3, {
        decision: TipoDecision.Rechazar,
        observacion: 'No cumple',
      } as DecisionSolicitudDto);
      expect(solicitudes.rechazar).toHaveBeenCalledWith(11, 3, 'No cumple');
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(adopciones.crear).not.toHaveBeenCalled();
      expect(r).toEqual({ solicitud: DETALLE, adopcion: null });
    });
  });
});
