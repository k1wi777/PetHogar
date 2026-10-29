import { EstadoSeguimiento } from './entities/seguimiento.enum';

/** Quién provoca el cambio: la tarea diaria, el cierre de la fundación o el cierre de la adopción. */
export type ActorSeguimiento = 'tarea' | 'resultado' | 'cierre';

interface Transicion {
  desde: EstadoSeguimiento;
  hasta: EstadoSeguimiento;
  actor: ActorSeguimiento;
}

/**
 * Única fuente de las transiciones. `realizado` y `cancelado` son terminales; `vencido` no lo es:
 * un seguimiento tardío todavía se puede cerrar. «Pendiente» = `programado` o `vencido`.
 */
const TRANSICIONES: readonly Transicion[] = [
  { desde: EstadoSeguimiento.Programado, hasta: EstadoSeguimiento.Vencido, actor: 'tarea' },
  { desde: EstadoSeguimiento.Programado, hasta: EstadoSeguimiento.Realizado, actor: 'resultado' },
  { desde: EstadoSeguimiento.Vencido, hasta: EstadoSeguimiento.Realizado, actor: 'resultado' },
  { desde: EstadoSeguimiento.Programado, hasta: EstadoSeguimiento.Cancelado, actor: 'cierre' },
  { desde: EstadoSeguimiento.Vencido, hasta: EstadoSeguimiento.Cancelado, actor: 'cierre' },
];

const PENDIENTES: readonly EstadoSeguimiento[] = [
  EstadoSeguimiento.Programado,
  EstadoSeguimiento.Vencido,
];

export class EstadoSeguimientoMaquina {
  static puede(
    desde: EstadoSeguimiento,
    hasta: EstadoSeguimiento,
    actor: ActorSeguimiento,
  ): boolean {
    return TRANSICIONES.some((t) => t.desde === desde && t.hasta === hasta && t.actor === actor);
  }

  /** Estados desde los que `actor` puede llegar a `hasta`; alimenta el `WHERE estado IN (…)` del UPDATE. */
  static origenesPara(hasta: EstadoSeguimiento, actor: ActorSeguimiento): EstadoSeguimiento[] {
    return TRANSICIONES.filter((t) => t.hasta === hasta && t.actor === actor).map((t) => t.desde);
  }

  static esPendiente(estado: EstadoSeguimiento): boolean {
    return PENDIENTES.includes(estado);
  }

  static pendientes(): readonly EstadoSeguimiento[] {
    return PENDIENTES;
  }
}
