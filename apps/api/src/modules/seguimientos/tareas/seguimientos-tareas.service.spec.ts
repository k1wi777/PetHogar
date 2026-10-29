import { Logger } from '@nestjs/common';
import { FollowUpOverdue, FollowUpReminder } from '../../../common/events';
import { RelojSimulado } from '../../../common/reloj/reloj-simulado';
import { TAMANO_LOTE } from '../seguimientos.constants';
import { SeguimientosTareasService } from './seguimientos-tareas.service';

const MANAGER = { id: 'manager' } as never;

interface Fila {
  id: number;
  adopcionId: number;
  fechaProgramada: string;
  estado: 'programado' | 'vencido' | 'realizado' | 'cancelado';
  recordatorio: boolean;
}
const fila = (id: number, fechaProgramada: string, extra: Partial<Fila> = {}): Fila => ({
  id,
  adopcionId: 100 + id,
  fechaProgramada,
  estado: 'programado',
  recordatorio: false,
  ...extra,
});

describe('SeguimientosTareasService (reloj simulado, base en memoria)', () => {
  const orden: string[] = [];
  let tabla: Fila[];
  const lotes: number[] = [];

  /** Réplica en memoria de la semántica de los UPDATE: solo toca lo que cumple el filtro. */
  const repo = {
    enTransaccion: jest.fn(async (trabajo: (m: unknown) => Promise<unknown>) => {
      orden.push('BEGIN');
      const r = await trabajo(MANAGER);
      orden.push('COMMIT');
      return r;
    }),
    vencerLote: jest.fn((_m: unknown, hoy: string, limite: number) => {
      const lote = tabla
        .filter((f) => f.estado === 'programado' && f.fechaProgramada < hoy)
        .slice(0, limite);
      lote.forEach((f) => (f.estado = 'vencido'));
      lotes.push(lote.length);
      return Promise.resolve(
        lote.map(({ id, adopcionId, fechaProgramada }) => ({ id, adopcionId, fechaProgramada })),
      );
    }),
    recordarLote: jest.fn((_m: unknown, hoy: string, dias: number, limite: number) => {
      const tope = new Date(Date.parse(`${hoy}T00:00:00Z`) + dias * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const lote = tabla
        .filter(
          (f) =>
            f.estado === 'programado' &&
            !f.recordatorio &&
            f.fechaProgramada >= hoy &&
            f.fechaProgramada <= tope,
        )
        .slice(0, limite);
      lote.forEach((f) => (f.recordatorio = true));
      lotes.push(lote.length);
      return Promise.resolve(
        lote.map(({ id, adopcionId, fechaProgramada }) => ({ id, adopcionId, fechaProgramada })),
      );
    }),
  };
  const eventos = { emit: jest.fn() };
  const config = { get: jest.fn() };
  // 2026-11-10 03:00 en Bogotá.
  const reloj = new RelojSimulado(new Date('2026-11-10T08:00:00Z'));
  const service = new SeguimientosTareasService(
    repo as never,
    eventos as never,
    reloj,
    config as never,
  );

  const emitidos = <T>(clase: { eventName: string }): T[] =>
    eventos.emit.mock.calls
      .filter(([nombre]: [string]) => nombre === clase.eventName)
      .map(([, evento]: [string, T]) => evento);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    reloj.fijar('2026-11-10T08:00:00Z');
    orden.length = 0;
    lotes.length = 0;
    tabla = [];
    config.get.mockReturnValue(3);
    eventos.emit.mockImplementation(() => orden.push('EMIT'));
  });

  describe('marcarVencidos', () => {
    it('vence al terminar el día programado: el de hoy sigue programado, el de ayer vence', async () => {
      tabla = [fila(1, '2026-11-09'), fila(2, '2026-11-10'), fila(3, '2026-11-11')];
      await expect(service.marcarVencidos()).resolves.toBe(1);
      expect(tabla.map((f) => f.estado)).toEqual(['vencido', 'programado', 'programado']);
      expect(emitidos<FollowUpOverdue>(FollowUpOverdue)).toEqual([new FollowUpOverdue(1, 101)]);
    });

    it('dos ejecuciones con el mismo reloj: una sola transición y un solo evento por fila', async () => {
      tabla = [fila(1, '2026-11-01'), fila(2, '2026-11-05'), fila(3, '2026-11-09')];
      await expect(service.marcarVencidos()).resolves.toBe(3);
      await expect(service.marcarVencidos()).resolves.toBe(0);
      expect(emitidos(FollowUpOverdue)).toHaveLength(3);
      expect(emitidos<FollowUpOverdue>(FollowUpOverdue).map((e) => e.seguimientoId)).toEqual([
        1, 2, 3,
      ]);
    });

    it('no toca realizado, cancelado ni los ya vencidos y no emite por ellos', async () => {
      tabla = [
        fila(1, '2026-10-01', { estado: 'realizado' }),
        fila(2, '2026-10-01', { estado: 'cancelado' }),
        fila(3, '2026-10-01', { estado: 'vencido' }),
      ];
      await expect(service.marcarVencidos()).resolves.toBe(0);
      expect(tabla.map((f) => f.estado)).toEqual(['realizado', 'cancelado', 'vencido']);
      expect(eventos.emit).not.toHaveBeenCalled();
    });

    it('«hoy» es el día de Bogotá: a las 04:59Z no vence el de ayer-UTC, a las 05:00Z sí', async () => {
      tabla = [fila(1, '2026-11-10')];
      reloj.fijar('2026-11-11T04:59:59Z');
      await service.marcarVencidos();
      expect(repo.vencerLote.mock.calls[0][1]).toBe('2026-11-10');
      expect(tabla[0].estado).toBe('programado');
      reloj.fijar('2026-11-11T05:00:00Z');
      await service.marcarVencidos();
      expect(repo.vencerLote.mock.calls[1][1]).toBe('2026-11-11');
      expect(tabla[0].estado).toBe('vencido');
    });

    it('trabaja por lotes de 500 hasta que un lote viene incompleto, con su propia transacción', async () => {
      tabla = Array.from({ length: 2 * TAMANO_LOTE + 3 }, (_, i) => fila(i + 1, '2026-10-01'));
      await expect(service.marcarVencidos()).resolves.toBe(2 * TAMANO_LOTE + 3);
      expect(lotes).toEqual([TAMANO_LOTE, TAMANO_LOTE, 3]);
      expect(repo.vencerLote.mock.calls.every((c) => c[2] === TAMANO_LOTE)).toBe(true);
      expect(emitidos(FollowUpOverdue)).toHaveLength(2 * TAMANO_LOTE + 3);
      expect(orden.filter((o) => o === 'BEGIN')).toHaveLength(3);
    });

    it('un lote exacto de 500 pide uno más y termina con uno vacío', async () => {
      tabla = Array.from({ length: TAMANO_LOTE }, (_, i) => fila(i + 1, '2026-10-01'));
      await service.marcarVencidos();
      expect(lotes).toEqual([TAMANO_LOTE, 0]);
    });

    it('emite solo después de confirmar cada lote', async () => {
      tabla = [fila(1, '2026-10-01'), fila(2, '2026-10-01')];
      await service.marcarVencidos();
      expect(orden).toEqual(['BEGIN', 'COMMIT', 'EMIT', 'EMIT']);
    });

    it('si el lote falla no emite nada de ese lote y propaga el error', async () => {
      repo.vencerLote.mockRejectedValueOnce(new Error('caída de la base'));
      await expect(service.marcarVencidos()).rejects.toThrow('caída de la base');
      expect(orden).toEqual(['BEGIN']);
      expect(eventos.emit).not.toHaveBeenCalled();
    });

    it('un listener que lanza no rompe la tarea ni deja de notificar al resto', async () => {
      tabla = [fila(1, '2026-10-01'), fila(2, '2026-10-01')];
      eventos.emit.mockImplementationOnce(() => {
        throw new Error('listener roto');
      });
      await expect(service.marcarVencidos()).resolves.toBe(2);
      expect(eventos.emit).toHaveBeenCalledTimes(2);
      expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('emitirRecordatorios', () => {
    it('avisa de los que vencen entre hoy y hoy+N (borde inclusivo) y deja constancia', async () => {
      tabla = [
        fila(1, '2026-11-09'), // ya pasó: no es recordatorio
        fila(2, '2026-11-10'), // hoy
        fila(3, '2026-11-13'), // hoy + 3 (borde)
        fila(4, '2026-11-14'), // hoy + 4: fuera
      ];
      await expect(service.emitirRecordatorios()).resolves.toBe(2);
      expect(tabla.map((f) => f.recordatorio)).toEqual([false, true, true, false]);
      const eventosEmitidos = emitidos<FollowUpReminder>(FollowUpReminder);
      expect(eventosEmitidos.map((e) => [e.seguimientoId, e.diasRestantes])).toEqual([
        [2, 0],
        [3, 3],
      ]);
      expect(eventosEmitidos[1].adopcionId).toBe(103);
      expect(eventosEmitidos[1].fechaProgramada.toISOString()).toBe('2026-11-13T05:00:00.000Z');
    });

    it('una sola vez por seguimiento: la segunda ejecución no repite', async () => {
      tabla = [fila(1, '2026-11-11')];
      await service.emitirRecordatorios();
      await service.emitirRecordatorios();
      expect(emitidos(FollowUpReminder)).toHaveLength(1);
    });

    it('respeta los días configurados y no recuerda a los que no están programados', async () => {
      config.get.mockReturnValue(1);
      tabla = [
        fila(1, '2026-11-11'),
        fila(2, '2026-11-12'),
        fila(3, '2026-11-11', { estado: 'vencido' }),
        fila(4, '2026-11-11', { estado: 'cancelado' }),
        fila(5, '2026-11-11', { estado: 'realizado' }),
      ];
      await expect(service.emitirRecordatorios()).resolves.toBe(1);
      expect(repo.recordarLote.mock.calls[0].slice(1)).toEqual(['2026-11-10', 1, TAMANO_LOTE]);
      expect(emitidos<FollowUpReminder>(FollowUpReminder)[0].seguimientoId).toBe(1);
    });

    it('usa 3 días si la configuración no los entrega', async () => {
      config.get.mockReturnValue(undefined);
      await service.emitirRecordatorios();
      expect(repo.recordarLote.mock.calls[0][2]).toBe(3);
    });

    it('un seguimiento ya vencido por el cron no recibe recordatorio y viceversa', async () => {
      tabla = [fila(1, '2026-11-09'), fila(2, '2026-11-11')];
      await service.marcarVencidos();
      await service.emitirRecordatorios();
      expect(tabla.map((f) => [f.estado, f.recordatorio])).toEqual([
        ['vencido', false],
        ['programado', true],
      ]);
    });

    it('trabaja por lotes y emite tras confirmar cada uno', async () => {
      tabla = Array.from({ length: TAMANO_LOTE + 1 }, (_, i) => fila(i + 1, '2026-11-11'));
      await expect(service.emitirRecordatorios()).resolves.toBe(TAMANO_LOTE + 1);
      expect(lotes).toEqual([TAMANO_LOTE, 1]);
      expect(orden.slice(0, 2)).toEqual(['BEGIN', 'COMMIT']);
      expect(orden[2]).toBe('EMIT');
    });
  });
});
