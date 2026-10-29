import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength, ValidateBy, ValidateIf } from 'class-validator';
import { Recortar } from '../../../common/validation/decoradores';
import {
  MAX_DESCRIPCION,
  MENSAJE_DESCRIPCION_OBLIGATORIA,
  MENSAJE_FORMATO_MONTO,
  MENSAJE_MONTO_MAXIMO,
  MENSAJE_MONTO_MAYOR_A_CERO,
  MENSAJE_MONTO_OBLIGATORIO,
} from '../donaciones.constants';
import { problemaDeMonto } from '../monto';
import { TipoDonacion } from '../entities/donacion.enum';

type Cuerpo = Partial<CamposDonacionDto>;
const esEconomica = (o: Cuerpo): boolean => o.tipo === TipoDonacion.Economica;
const esEspecie = (o: Cuerpo): boolean => o.tipo === TipoDonacion.Especie;

/** Monto como cadena: nunca se convierte a `Number`. Los vacíos los reporta `@IsNotEmpty`. */
const MontoValido = (): PropertyDecorator =>
  ValidateBy({
    name: 'montoValido',
    validator: {
      validate: (valor: unknown) =>
        typeof valor !== 'string' || valor === '' || problemaDeMonto(valor) === null,
      defaultMessage: (argumentos) => {
        const valor: unknown = argumentos?.value;
        const problema = typeof valor === 'string' ? problemaDeMonto(valor) : null;
        if (problema === 'cero') return MENSAJE_MONTO_MAYOR_A_CERO;
        if (problema === 'maximo') return MENSAJE_MONTO_MAXIMO;
        return MENSAJE_FORMATO_MONTO;
      },
    },
  });

/**
 * Campos comunes del cuerpo multipart (todo llega como texto, junto al archivo `comprobante`).
 * Los campos que no corresponden al tipo se ignoran (no se validan ni se guardan).
 */
export class CamposDonacionDto {
  @ApiProperty({ enum: TipoDonacion })
  @IsEnum(TipoDonacion, { message: 'El tipo debe ser economica o especie' })
  tipo!: TipoDonacion;

  @ApiPropertyOptional({
    example: '50000.50',
    description: 'Obligatorio si es económica: mayor que 0, hasta 2 decimales y 1.000.000.000',
  })
  @Recortar()
  @ValidateIf(esEconomica)
  @IsString({ message: MENSAJE_MONTO_OBLIGATORIO })
  @IsNotEmpty({ message: MENSAJE_MONTO_OBLIGATORIO })
  @MontoValido()
  monto?: string;

  @ApiPropertyOptional({
    maxLength: MAX_DESCRIPCION,
    description: 'Obligatoria si es en especie',
  })
  @Recortar()
  @ValidateIf(esEspecie)
  @IsString({ message: MENSAJE_DESCRIPCION_OBLIGATORIA })
  @IsNotEmpty({ message: MENSAJE_DESCRIPCION_OBLIGATORIA })
  @MaxLength(MAX_DESCRIPCION, { message: MENSAJE_DESCRIPCION_OBLIGATORIA })
  descripcion?: string;
}
