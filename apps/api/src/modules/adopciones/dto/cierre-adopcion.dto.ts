import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';
import { Recortar } from '../../../common/validation/decoradores';

export enum EstadoCierre {
  Finalizada = 'finalizada',
  Revocada = 'revocada',
}

/** Estado al que vuelve la mascota cuando se revoca la adopción. */
export enum DestinoMascota {
  Disponible = 'disponible',
  Inactiva = 'inactiva',
}

export const MAX_MOTIVO_CIERRE = 300;

export class CierreAdopcionDto {
  @ApiProperty({ enum: EstadoCierre })
  @IsEnum(EstadoCierre, { message: 'El estado debe ser finalizada o revocada' })
  estado!: EstadoCierre;

  @ApiProperty({ maxLength: MAX_MOTIVO_CIERRE })
  @Recortar()
  @IsString({ message: 'El motivo debe ser un texto' })
  @IsNotEmpty({ message: 'Debes indicar el motivo' })
  @MaxLength(MAX_MOTIVO_CIERRE, {
    message: `El motivo no puede superar ${MAX_MOTIVO_CIERRE} caracteres`,
  })
  motivo!: string;

  @ApiPropertyOptional({
    enum: DestinoMascota,
    description:
      'Obligatorio al revocar (la mascota vuelve a disponible o queda inactiva) e ignorado al finalizar',
  })
  @ValidateIf((o: Partial<CierreAdopcionDto>) => o.estado === EstadoCierre.Revocada)
  @IsEnum(DestinoMascota, {
    message: 'Indica si la mascota vuelve a estar disponible o inactiva',
  })
  mascotaDestino?: DestinoMascota;
}
