import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { ID_MAXIMO } from '../../../common/pipes/id-entero.pipe';
import { EnteroEstricto } from '../../../common/validation/decoradores';
import { CamposDonacionDto } from './campos-donacion.dto';

/** El donante nunca viene en el cuerpo: sale del token. */
export class CrearDonacionDto extends CamposDonacionDto {
  @ApiProperty({ description: 'Fundación destinataria (debe estar aprobada)' })
  @EnteroEstricto()
  @IsInt({ message: 'La fundación debe ser un número entero' })
  @Min(1, { message: 'La fundación no es válida' })
  @Max(ID_MAXIMO, { message: 'La fundación no es válida' })
  fundacionId!: number;
}
