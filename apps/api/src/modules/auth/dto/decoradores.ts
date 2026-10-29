import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { BooleanoEstricto, Recortar } from '../../../common/validation/decoradores';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

/** Correo sin espacios y en minúsculas, para que la unicidad no dependa de las mayúsculas. */
export const CorreoNormalizado = (): PropertyDecorator =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim().toLowerCase() : value,
    ),
    MaxLength(100, { message: 'El correo no puede superar los 100 caracteres' }),
    IsEmail({}, { message: 'Ingresa un correo electrónico válido' }),
  );

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

export { BooleanoEstricto, Recortar };
