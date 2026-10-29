import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Recortar } from '../../../common/validation/decoradores';
import { EstadoBienestar } from '../entities/seguimiento.enum';
import { MAX_TEXTO } from '../seguimientos.constants';
import { EsFechaReal } from './campos';

/** Cuerpo multipart: los campos llegan como texto, junto a hasta 5 archivos en `evidencias`. */
export class RegistrarResultadoDto {
  @ApiProperty({
    example: '2026-12-14',
    description: 'AAAA-MM-DD; entre la fecha de entrega y hoy',
  })
  @Recortar()
  @IsNotEmpty({ message: 'Debes indicar la fecha en que se realizó el seguimiento' })
  @EsFechaReal('La fecha realizada debe ser una fecha real con formato AAAA-MM-DD')
  fechaRealizada!: string;

  @ApiProperty({ enum: EstadoBienestar })
  @IsEnum(EstadoBienestar, { message: 'El estado de bienestar debe ser bueno, regular o malo' })
  estadoBienestar!: EstadoBienestar;

  @ApiProperty({ maxLength: MAX_TEXTO })
  @Recortar()
  @IsString({ message: 'Las observaciones deben ser un texto' })
  @IsNotEmpty({ message: 'Las observaciones son obligatorias' })
  @MaxLength(MAX_TEXTO, {
    message: `Las observaciones no pueden superar ${MAX_TEXTO} caracteres`,
  })
  observaciones!: string;
}
