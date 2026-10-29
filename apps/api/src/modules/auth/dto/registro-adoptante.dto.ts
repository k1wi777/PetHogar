import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Equals,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  BooleanoEstricto,
  ContrasenaSegura,
  CorreoNormalizado,
  MENSAJE_TELEFONO,
  Recortar,
  TELEFONO_REGEX,
} from './decoradores';

const TIPOS_DOCUMENTO = ['CC', 'CE', 'PA'] as const;

export class RegistroAdoptanteDto {
  @Recortar()
  @IsString({ message: 'El primer nombre es obligatorio' })
  @IsNotEmpty({ message: 'El primer nombre es obligatorio' })
  @MaxLength(40, { message: 'El primer nombre no puede superar los 40 caracteres' })
  primerNombre!: string;

  @ApiPropertyOptional()
  @Recortar()
  @IsOptional()
  @IsString({ message: 'El segundo nombre debe ser un texto' })
  @MaxLength(40, { message: 'El segundo nombre no puede superar los 40 caracteres' })
  segundoNombre?: string;

  @Recortar()
  @IsString({ message: 'El primer apellido es obligatorio' })
  @IsNotEmpty({ message: 'El primer apellido es obligatorio' })
  @MaxLength(40, { message: 'El primer apellido no puede superar los 40 caracteres' })
  primerApellido!: string;

  @ApiPropertyOptional()
  @Recortar()
  @IsOptional()
  @IsString({ message: 'El segundo apellido debe ser un texto' })
  @MaxLength(40, { message: 'El segundo apellido no puede superar los 40 caracteres' })
  segundoApellido?: string;

  @ApiProperty({ enum: TIPOS_DOCUMENTO })
  @IsIn(TIPOS_DOCUMENTO, { message: 'El tipo de documento debe ser CC, CE o PA' })
  tipoDocumento!: (typeof TIPOS_DOCUMENTO)[number];

  @Recortar()
  @Matches(/^[A-Za-z0-9]{4,20}$/, {
    message: 'El número de documento debe tener entre 4 y 20 letras o números, sin espacios',
  })
  numeroDocumento!: string;

  @ApiProperty({ example: '1995-04-23' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha de nacimiento debe tener el formato AAAA-MM-DD',
  })
  @IsISO8601({ strict: true }, { message: 'La fecha de nacimiento no es válida' })
  fechaNacimiento!: string;

  @Recortar()
  @Matches(TELEFONO_REGEX, { message: MENSAJE_TELEFONO })
  telefono!: string;

  @CorreoNormalizado()
  email!: string;

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

  @ApiProperty({ description: 'Mínimo 8 caracteres con mayúscula, minúscula y número' })
  @ContrasenaSegura()
  contrasena!: string;

  @BooleanoEstricto()
  @Equals(true, { message: 'Debes aceptar la política de tratamiento de datos personales' })
  aceptaPoliticaDatos!: boolean;
}
