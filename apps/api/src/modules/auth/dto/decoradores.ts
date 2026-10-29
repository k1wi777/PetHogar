import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

/** Recorta espacios en los textos; los valores que no son texto se dejan para que los rechace el validador. */
export const Recortar = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

/** Correo sin espacios y en minúsculas, para que la unicidad no dependa de las mayúsculas. */
export const CorreoNormalizado = (): PropertyDecorator =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim().toLowerCase() : value,
    ),
    MaxLength(100, { message: 'El correo no puede superar los 100 caracteres' }),
    IsEmail({}, { message: 'Ingresa un correo electrónico válido' }),
  );

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

/** Política: 8 a 64 caracteres (el tope evita el límite de 72 bytes de bcrypt) con mayúscula, minúscula y número. */
export const ContrasenaSegura = (): PropertyDecorator =>
  applyDecorators(
    IsString({ message: 'La contraseña debe ser un texto' }),
    Length(8, 64, { message: 'La contraseña debe tener entre 8 y 64 caracteres' }),
    Matches(/[A-Z]/, { message: 'La contraseña debe incluir al menos una letra mayúscula' }),
    Matches(/[a-z]/, { message: 'La contraseña debe incluir al menos una letra minúscula' }),
    Matches(/\d/, { message: 'La contraseña debe incluir al menos un número' }),
  );

export const TELEFONO_REGEX = /^\+?\d{7,14}$/;
export const MENSAJE_TELEFONO = 'El teléfono debe tener entre 7 y 14 dígitos (puede iniciar con +)';
