export type TipoReferencia = 'solicitud' | 'seguimiento' | 'fundacion' | 'donacion' | 'adopcion';

/** Entidad a la que se refiere el aviso; el backend no incluye referencia a mascota. */
export interface ReferenciaNotificacion {
  /** Texto abierto: el backend puede añadir tipos nuevos. */
  tipo: string;
  id: number;
}

/** Recurso de `GET /notificaciones`. `titulo` y `mensaje` son texto plano del backend. */
export interface Notificacion {
  id: number;
  /** Varchar abierto en el backend (solicitud, seguimiento, validacion, donacion, adopcion…). */
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  fechaCreacion: string;
  referencia: ReferenciaNotificacion | null;
}

export type FiltroLeida = 'todas' | 'no-leidas' | 'leidas';

export interface ConsultaNotificaciones {
  pagina: number;
  filtro: FiltroLeida;
}
