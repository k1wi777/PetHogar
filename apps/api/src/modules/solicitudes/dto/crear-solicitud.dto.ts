import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ID_MAXIMO } from '../../../common/pipes/id-entero.pipe';
import { BooleanoEstricto, EnteroEstricto, Recortar } from '../../../common/validation/decoradores';
import { TIPOS_VIVIENDA, type TipoVivienda } from '../solicitudes.types';

export const MAX_MOTIVO = 500;

/** Cuerpo multipart: todos los campos llegan como texto, junto al archivo `formulario`. */
export class CrearSolicitudDto {
  @ApiProperty({ description: 'Id de la mascota que se quiere adoptar' })
  @EnteroEstricto()
  @IsInt({ message: 'La mascota debe ser un número entero' })
  @Min(1, { message: 'La mascota no es válida' })
  @Max(ID_MAXIMO, { message: 'La mascota no es válida' })
  mascotaId!: number;

  @ApiProperty({ maxLength: MAX_MOTIVO })
  @Recortar()
  @IsString({ message: 'El motivo debe ser un texto' })
  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  @MaxLength(MAX_MOTIVO, { message: `El motivo no puede superar ${MAX_MOTIVO} caracteres` })
  motivo!: string;

  @ApiProperty({ enum: TIPOS_VIVIENDA })
  @IsEnum(TIPOS_VIVIENDA, { message: 'El tipo de vivienda debe ser casa, apartamento o finca' })
  tipoVivienda!: TipoVivienda;

  @ApiProperty({ type: Boolean, description: '"true" o "false"' })
  @BooleanoEstricto()
  @IsBoolean({ message: 'Indica si tienes otras mascotas (true o false)' })
  tieneOtrasMascotas!: boolean;
}
