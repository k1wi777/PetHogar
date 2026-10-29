import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { EntityManager } from 'typeorm';
import { FollowUpOverdue, FollowUpReminder } from '../../../common/events';
import { emitirSeguro } from '../../../common/events/emitir-seguro';
import { Reloj } from '../../../common/reloj/reloj';
import { diasEntre, hoyEnBogota, inicioDelDiaEnBogota } from '../../../common/validation/fecha';
import type { EnvironmentVariables } from '../../../config/env.validation';
import { TAMANO_LOTE } from '../seguimientos.constants';
import { SeguimientosRepository } from '../seguimientos.repository';
import type { SeguimientoDeTarea } from '../seguimientos.types';

/** Valor por defecto si la configuración no entrega los días del recordatorio. */
const DIAS_RECORDATORIO_POR_DEFECTO = 3;

/**
 * Tareas periódicas de seguimientos. Cada una trabaja por lotes: un `UPDATE … RETURNING` con
 * `FOR UPDATE SKIP LOCKED` en su propia transacción y, ya confirmado el lote, un evento por fila.
 * Es idempotente (lo ya vencido o recordado no vuelve a seleccionarse) y segura con varias
 * ejecuciones o instancias simultáneas, que se reparten filas distintas. La entrega de eventos es
 * *at-most-once*: si el proceso muere entre el commit y la emisión, el estado queda correcto pero
 * el evento se pierde.
 */
@Injectable()
export class SeguimientosTareasService {
  private readonly logger = new Logger(SeguimientosTareasService.name);

  constructor(
    private readonly repo: SeguimientosRepository,
    private readonly eventos: EventEmitter2,
    private readonly reloj: Reloj,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  /** Pasa a `vencido` los `programado` con fecha anterior a hoy (vencen al terminar su día). */
  async marcarVencidos(): Promise<number> {
    const hoy = hoyEnBogota(this.reloj.ahora());
    return this.porLotes(
      (manager) => this.repo.vencerLote(manager, hoy, TAMANO_LOTE),
      (fila) =>
        emitirSeguro(
          this.eventos,
          FollowUpOverdue.eventName,
          new FollowUpOverdue(fila.id, fila.adopcionId),
          this.logger,
        ),
    );
  }

  /** Avisa una sola vez de los `programado` que vencen entre hoy y los próximos N días. */
  async emitirRecordatorios(): Promise<number> {
    const hoy = hoyEnBogota(this.reloj.ahora());
    const dias =
      this.config.get('SEGUIMIENTOS_RECORDATORIO_DIAS', { infer: true }) ??
      DIAS_RECORDATORIO_POR_DEFECTO;
    return this.porLotes(
      (manager) => this.repo.recordarLote(manager, hoy, dias, TAMANO_LOTE),
      (fila) =>
        emitirSeguro(
          this.eventos,
          FollowUpReminder.eventName,
          new FollowUpReminder(
            fila.id,
            fila.adopcionId,
            inicioDelDiaEnBogota(fila.fechaProgramada),
            diasEntre(hoy, fila.fechaProgramada),
          ),
          this.logger,
        ),
    );
  }

  private async porLotes(
    lote: (manager: EntityManager) => Promise<SeguimientoDeTarea[]>,
    emitir: (fila: SeguimientoDeTarea) => void,
  ): Promise<number> {
    let total = 0;
    for (;;) {
      const filas = await this.repo.enTransaccion(lote);
      filas.forEach(emitir);
      total += filas.length;
      if (filas.length < TAMANO_LOTE) return total;
    }
  }
}
