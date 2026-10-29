export const LIMITE_TITULO = 100;
export const LIMITE_MENSAJE = 300;
export const LIMITE_CLAVE = 80;

/** Tipos de notificación (columna `varchar(30)` sin enum, para ampliarlos sin migración). */
export const TIPOS_NOTIFICACION = [
  'solicitud',
  'seguimiento',
  'validacion',
  'donacion',
  'adopcion',
] as const;

/** Entidad a la que apunta la notificación: el front elige la pantalla según el rol. */
export const ENTIDADES_NOTIFICACION = [
  'solicitud',
  'seguimiento',
  'fundacion',
  'donacion',
  'adopcion',
] as const;

export const MENSAJE_NOTIFICACION_NO_EXISTE = 'La notificación no existe';
