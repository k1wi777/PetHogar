import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { Recortar } from '../../../common/validation/decoradores';
import { MAX_NOMBRE_DONANTE, MIN_NOMBRE_DONANTE } from '../donaciones.constants';
import { CamposDonacionDto } from './campos-donacion.dto';

const MENSAJE_NOMBRE = `El nombre del donante debe tener entre ${MIN_NOMBRE_DONANTE} y ${MAX_NOMBRE_DONANTE} caracteres`;

/** Aporte presencial: el donante no tiene usuario, solo un nombre; la fundación sale del token. */
export class CrearDonacionManualDto extends CamposDonacionDto {
  @ApiProperty({ minLength: MIN_NOMBRE_DONANTE, maxLength: MAX_NOMBRE_DONANTE })
  @Recortar()
  @IsString({ message: MENSAJE_NOMBRE })
  @IsNotEmpty({ message: MENSAJE_NOMBRE })
  @MinLength(MIN_NOMBRE_DONANTE, { message: MENSAJE_NOMBRE })
  @MaxLength(MAX_NOMBRE_DONANTE, { message: MENSAJE_NOMBRE })
  nombreDonante!: string;
}
