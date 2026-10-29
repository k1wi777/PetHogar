import { EstadoMascota } from './entities/mascota.enum';

/** Quién pide el cambio: la ruta de la fundación o el flujo de adopción (Fase 3). */
export type OrigenCambio = 'fundacion' | 'adopcion';

interface Transicion {
  desde: EstadoMascota;
  hasta: EstadoMascota;
  origenes: readonly OrigenCambio[];
}

/**
 * Única fuente de las transiciones de estado. `adoptada` e `inactiva` son terminales: ninguna
 * ruta las revierte. La fundación solo puede dar de baja una mascota disponible; las otras dos
 * transiciones pertenecen al flujo de adopción.
 */
const TRANSICIONES: readonly Transicion[] = [
  {
    desde: EstadoMascota.Disponible,
    hasta: EstadoMascota.EnProceso,
    origenes: ['adopcion'],
  },
  {
    desde: EstadoMascota.EnProceso,
    hasta: EstadoMascota.Adoptada,
    origenes: ['adopcion'],
  },
  {
    desde: EstadoMascota.Disponible,
    hasta: EstadoMascota.Inactiva,
    origenes: ['fundacion'],
  },
];

const EDITABLES: readonly EstadoMascota[] = [EstadoMascota.Disponible, EstadoMascota.EnProceso];

export class EstadoMascotaMaquina {
  static puede(desde: EstadoMascota, hasta: EstadoMascota, origen: OrigenCambio): boolean {
    return TRANSICIONES.some(
      (t) => t.desde === desde && t.hasta === hasta && t.origenes.includes(origen),
    );
  }

  /** Estados desde los que `origen` puede llegar a `hasta` (vacío si no hay ninguna transición). */
  static origenesPara(hasta: EstadoMascota, origen: OrigenCambio): EstadoMascota[] {
    return TRANSICIONES.filter((t) => t.hasta === hasta && t.origenes.includes(origen)).map(
      (t) => t.desde,
    );
  }

  /** Solo `disponible` y `en_proceso` admiten cambios en sus datos descriptivos. */
  static editable(estado: EstadoMascota): boolean {
    return EDITABLES.includes(estado);
  }

  static estadosEditables(): readonly EstadoMascota[] {
    return EDITABLES;
  }
}
