import type { ENTIDADES_NOTIFICACION, TIPOS_NOTIFICACION } from './notificaciones.constants';

export type TipoNotificacion = (typeof TIPOS_NOTIFICACION)[number];
export type EntidadNotificacion = (typeof ENTIDADES_NOTIFICACION)[number];

export interface ReferenciaNotificacion {
  tipo: EntidadNotificacion;
  id: number;
}

/** Lo que crea quien avisa (los listeners); el título y el mensaje se recortan al guardar. */
export interface NuevaNotificacion {
  usuarioId: number;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  referencia?: ReferenciaNotificacion;
  /** Clave de deduplicación por destinatario (`<evento>:<id>`); sin clave no se deduplica. */
  clave?: string;
}

/** Vista de una notificación: sin destinatario ni clave de deduplicación. */
export interface NotificacionVista {
  id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  fechaCreacion: Date;
  referencia: { tipo: string; id: number } | null;
}

export interface FiltroNotificaciones {
  leida?: boolean;
}
