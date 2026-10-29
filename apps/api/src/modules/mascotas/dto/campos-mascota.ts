import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ID_MAXIMO } from '../../../common/pipes/id-entero.pipe';
import { BooleanoEstricto, EnteroEstricto, Recortar } from '../../../common/validation/decoradores';
import { SexoMascota, TamanoMascota } from '../entities/mascota.enum';

/**
 * Decoradores de los campos descriptivos de una mascota, compartidos por el alta (todos
 * obligatorios salvo los opcionales de siempre) y la edición (todos opcionales, pero un valor
 * presente se valida igual: `null` en un campo obligatorio se rechaza, no llega a la base).
 */
export const LIMITES = { nombre: 60, color: 40, estadoSalud: 200, descripcion: 500 } as const;
export const EDAD_MAXIMA_MESES = 360;

const ausente = (_: unknown, valor: unknown): boolean => valor !== undefined;

/** En la edición, un campo ausente no se valida; uno presente sí. */
const parcial = (edicion: boolean): PropertyDecorator[] => (edicion ? [ValidateIf(ausente)] : []);

const swagger = (edicion: boolean, opciones: Record<string, unknown>): PropertyDecorator =>
  edicion ? ApiPropertyOptional(opciones) : ApiProperty(opciones);

export const CampoNombre = (edicion = false): PropertyDecorator =>
  applyDecorators(
    swagger(edicion, { maxLength: LIMITES.nombre, example: 'Firulais' }),
    ...parcial(edicion),
    Recortar(),
    IsString({ message: 'El nombre debe ser un texto' }),
    IsNotEmpty({ message: 'El nombre es obligatorio' }),
    MaxLength(LIMITES.nombre, {
      message: `El nombre no puede superar ${LIMITES.nombre} caracteres`,
    }),
  );

export const CampoRazaId = (edicion = false): PropertyDecorator =>
  applyDecorators(
    swagger(edicion, { description: 'Id de la raza (ver GET /especies/:id/razas)' }),
    ...parcial(edicion),
    EnteroEstricto(),
    IsInt({ message: 'La raza debe ser un número entero' }),
    Min(1, { message: 'La raza no es válida' }),
    Max(ID_MAXIMO, { message: 'La raza no es válida' }),
  );

export const CampoSexo = (edicion = false): PropertyDecorator =>
  applyDecorators(
    swagger(edicion, { enum: SexoMascota }),
    ...parcial(edicion),
    IsEnum(SexoMascota, { message: 'El sexo debe ser macho o hembra' }),
  );

export const CampoEdadMeses = (edicion = false): PropertyDecorator =>
  applyDecorators(
    swagger(edicion, { minimum: 0, maximum: EDAD_MAXIMA_MESES, description: 'Edad en meses' }),
    ...parcial(edicion),
    EnteroEstricto(),
    IsInt({ message: 'La edad debe ser un número entero de meses' }),
    Min(0, { message: 'La edad no puede ser negativa' }),
    Max(EDAD_MAXIMA_MESES, { message: `La edad no puede superar ${EDAD_MAXIMA_MESES} meses` }),
  );

export const CampoTamano = (edicion = false): PropertyDecorator =>
  applyDecorators(
    swagger(edicion, { enum: TamanoMascota }),
    ...parcial(edicion),
    IsEnum(TamanoMascota, { message: 'El tamaño debe ser pequeño, mediano o grande' }),
  );

export const CampoEstadoSalud = (edicion = false): PropertyDecorator =>
  applyDecorators(
    swagger(edicion, { maxLength: LIMITES.estadoSalud, example: 'Sano y desparasitado' }),
    ...parcial(edicion),
    Recortar(),
    IsString({ message: 'El estado de salud debe ser un texto' }),
    IsNotEmpty({ message: 'El estado de salud es obligatorio' }),
    MaxLength(LIMITES.estadoSalud, {
      message: `El estado de salud no puede superar ${LIMITES.estadoSalud} caracteres`,
    }),
  );

/** Texto opcional con `null` permitido; una cadena vacía se guarda como `null`. */
const textoOpcional = (etiqueta: string, max: number): PropertyDecorator =>
  applyDecorators(
    ApiPropertyOptional({ maxLength: max, nullable: true, type: String }),
    IsOptional(),
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim() || null : value,
    ),
    IsString({ message: `${etiqueta} debe ser un texto` }),
    MaxLength(max, { message: `${etiqueta} no puede superar ${max} caracteres` }),
  );

export const CampoColor = (): PropertyDecorator => textoOpcional('El color', LIMITES.color);
export const CampoDescripcion = (): PropertyDecorator =>
  textoOpcional('La descripción', LIMITES.descripcion);

export const CampoBooleano = (etiqueta: string): PropertyDecorator =>
  applyDecorators(
    ApiPropertyOptional({ type: Boolean, default: false }),
    ...parcial(true),
    BooleanoEstricto(),
    IsBoolean({ message: `${etiqueta} debe ser verdadero o falso` }),
  );
