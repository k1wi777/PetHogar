import { EstadoMascota } from './entities/mascota.enum';

/**
 * Quién pide el cambio: la ruta de la fundación, el flujo de adopción o la revocación de una
 * adopción (único camino que saca una mascota de `adoptada`).
 */
export type OrigenCambio = 'fundacion' | 'adopcion' | 'revocacion';

interface Transicion {
  desde: EstadoMascota;
  hasta: EstadoMascota;
  origenes: readonly OrigenCambio[];
}

/**
 * Única fuente de las transiciones de estado. `inactiva` es terminal y `adoptada` solo se
 * abandona al revocar la adopción (origen `revocacion`, a `disponible` o `inactiva`). La
 * fundación solo puede dar de baja una mascota disponible; las transiciones hacia `en_proceso`
 * y `adoptada` pertenecen al flujo de adopción.
 */
const TRANSICIONES: readonly Transicion[] = [
  {
    desde: EstadoMascota.Disponible,
    hasta: EstadoMascota.EnProceso,
    origenes: ['adopcion'],
  },
  // Aprobar una solicitud no pasa antes por `en_proceso`: crear solicitudes no cambia el estado.
  {
    desde: EstadoMascota.Disponible,
    hasta: EstadoMascota.Adoptada,
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
  // Revocar una adopción: la fundación decide si la mascota vuelve al catálogo o queda inactiva.
  {
    desde: EstadoMascota.Adoptada,
    hasta: EstadoMascota.Disponible,
    origenes: ['revocacion'],
  },
  {
    desde: EstadoMascota.Adoptada,
    hasta: EstadoMascota.Inactiva,
    origenes: ['revocacion'],
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
