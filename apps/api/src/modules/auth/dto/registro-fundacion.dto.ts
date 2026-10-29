import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Equals, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
  BooleanoEstricto,
  ContrasenaSegura,
  CorreoNormalizado,
  MENSAJE_TELEFONO,
  Recortar,
  TELEFONO_REGEX,
} from './decoradores';

/** Campos de texto de un formulario multipart; el documento legal llega aparte (`documento`). */
export class RegistroFundacionDto {
  @Recortar()
  @IsString({ message: 'El nombre de la fundación es obligatorio' })
  @IsNotEmpty({ message: 'El nombre de la fundación es obligatorio' })
  @MaxLength(120, { message: 'El nombre no puede superar los 120 caracteres' })
  nombre!: string;

  @ApiProperty({ example: '900123456-7' })
  @Recortar()
  @Matches(/^[0-9][0-9.-]{3,18}[0-9]$/, {
    message: 'El NIT debe tener entre 5 y 20 caracteres: números, puntos o guion',
  })
  nit!: string;

  @Recortar()
  @IsString({ message: 'La dirección es obligatoria' })
  @IsNotEmpty({ message: 'La dirección es obligatoria' })
  @MaxLength(150, { message: 'La dirección no puede superar los 150 caracteres' })
  direccion!: string;

  @Recortar()
  @IsString({ message: 'La ciudad es obligatoria' })
  @IsNotEmpty({ message: 'La ciudad es obligatoria' })
  @MaxLength(60, { message: 'La ciudad no puede superar los 60 caracteres' })
  ciudad!: string;

  @ApiPropertyOptional()
  @Recortar()
  @IsOptional()
  @IsString({ message: 'La descripción debe ser un texto' })
  @MaxLength(500, { message: 'La descripción no puede superar los 500 caracteres' })
  descripcion?: string;

  @Recortar()
  @Matches(TELEFONO_REGEX, { message: MENSAJE_TELEFONO })
  telefono!: string;

  @CorreoNormalizado()
  email!: string;

  @ApiProperty({ description: 'Mínimo 8 caracteres con mayúscula, minúscula y número' })
  @ContrasenaSegura()
  contrasena!: string;

  @ApiProperty({ type: Boolean })
  @BooleanoEstricto()
  @Equals(true, { message: 'Debes aceptar la política de tratamiento de datos personales' })
  aceptaPoliticaDatos!: boolean;
}

export class RegistroFundacionMultipartDto extends RegistroFundacionDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Documento legal JPG, PNG o PDF (máx. 5 MB)',
  })
  documento!: unknown;
}
