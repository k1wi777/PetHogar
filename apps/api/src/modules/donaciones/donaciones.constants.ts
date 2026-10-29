/** Tope de un aporte: cabe en `numeric(12,2)` y frena errores de digitación. */
export const MONTO_MAXIMO = '1000000000';
export const MAX_DECIMALES = 2;
export const MAX_DESCRIPCION = 300;
export const MIN_NOMBRE_DONANTE = 2;
export const MAX_NOMBRE_DONANTE = 100;

export const MENSAJE_FORMATO_MONTO = 'Usa solo números y punto decimal, hasta 2 decimales';
export const MENSAJE_MONTO_MAYOR_A_CERO = 'El monto debe ser mayor que 0';
export const MENSAJE_MONTO_MAXIMO = 'El monto no puede superar $ 1.000.000.000';
export const MENSAJE_MONTO_OBLIGATORIO = 'Indica el monto de la donación económica';
export const MENSAJE_DESCRIPCION_OBLIGATORIA = 'Describe lo que donas (entre 1 y 300 caracteres)';

export const MENSAJE_FUNDACION_NO_RECIBE = 'La fundación no existe o no recibe donaciones';
export const MENSAJE_DONACION_PROPIA = 'No puedes registrar una donación a tu propia fundación';
export const MENSAJE_COMPROBANTE_NO_EXISTE = 'La donación o su comprobante no existe';
export const MENSAJE_PERIODO_INVERTIDO = 'La fecha final no puede ser anterior a la inicial';
