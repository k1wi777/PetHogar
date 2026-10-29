import { Transform } from 'class-transformer';

/** Recorta espacios en los textos; los valores que no son texto se dejan para que los rechace el validador. */
export const Recortar = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

/**
 * Booleano estricto: con la conversión implícita global, la cadena "false" de un formulario
 * multipart se convertiría en `true`.
 */
export const BooleanoEstricto = (): PropertyDecorator =>
  Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
    const valor = obj[key];
    if (valor === 'true') return true;
    if (valor === 'false') return false;
    return valor;
  });

/**
 * Entero estricto: acepta un número o un texto de solo dígitos (query string). La conversión
 * implícita global convertiría `true` en 1 o `""` en 0; aquí cualquier otro valor llega intacto
 * a `@IsInt`, que lo rechaza.
 */
export const EnteroEstricto = (): PropertyDecorator =>
  Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
    const valor = obj[key];
    if (typeof valor === 'string' && /^-?\d{1,15}$/.test(valor.trim())) return Number(valor);
    return valor;
  });
