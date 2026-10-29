import { ZONA_HORARIA } from '../../common/validation/fecha';

/** Fotos máximas del reporte del adoptante y de las evidencias de la fundación. */
export const MAX_FOTOS = 5;
/** `seguimiento.observaciones` y `seguimiento.reporte_adoptante` son `varchar(500)`. */
export const MAX_TEXTO = 500;
/** Un resumen por adopción trae como mucho los 20 seguimientos más recientes. */
export const MAX_RESUMEN_POR_ADOPCION = 20;
/** Filas por lote de las tareas programadas (cada lote es una transacción). */
export const TAMANO_LOTE = 500;
/** Zona de las tareas programadas: la misma en la que se evalúa «hoy». */
export const ZONA_HORARIA_TAREAS = ZONA_HORARIA;

export const CONSTRAINT_PENDIENTE = 'uq_seguimiento_pendiente';

export const MENSAJE_SEGUIMIENTO_NO_EXISTE = 'El seguimiento no existe';
export const MENSAJE_ADOPCION_NO_EXISTE = 'La adopción no existe';
export const MENSAJE_SOLO_ADOPTANTES = 'Esta acción es exclusiva de adoptantes';
export const MENSAJE_DUPLICADO = 'Ya hay un seguimiento de ese tipo programado para esa fecha';
export const MENSAJE_VISITA_SIN_REPORTE = 'Este seguimiento es una visita y no admite reporte';
export const MENSAJE_REPORTE_PENDIENTE = 'El adoptante todavía no ha enviado el reporte';
export const MENSAJE_FOTO_NO_EXISTE = 'La foto no existe';
