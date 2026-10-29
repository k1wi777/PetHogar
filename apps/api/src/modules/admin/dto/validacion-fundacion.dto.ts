import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';
import { Recortar } from '../../auth/dto/decoradores';
import { EstadoValidacion } from '../../fundaciones/entities/fundacion.enum';
import type { DecisionValidacion } from '../../fundaciones/fundaciones.types';

export const MAX_OBSERVACION = 300;
const DECISIONES = [EstadoValidacion.Aprobada, EstadoValidacion.Rechazada];

export class ValidacionFundacionDto {
  @ApiProperty({ enum: DECISIONES })
  @IsIn(DECISIONES, { message: 'La decisión debe ser «aprobada» o «rechazada»' })
  decision!: DecisionValidacion;

  @ApiPropertyOptional({
    maxLength: MAX_OBSERVACION,
    description: 'Obligatoria al rechazar; opcional al aprobar',
  })
  @Recortar()
  // Al aprobar, una observación vacía o ausente no se valida (el service la guarda como null).
  @ValidateIf(
    (dto: ValidacionFundacionDto) =>
      dto.decision === EstadoValidacion.Rechazada ||
      (dto.observacion !== undefined && dto.observacion !== null && dto.observacion !== ''),
  )
  @IsString({ message: 'La observación debe ser un texto' })
  @IsNotEmpty({ message: 'Indica el motivo del rechazo' })
  @MaxLength(MAX_OBSERVACION, {
    message: `La observación no puede superar los ${MAX_OBSERVACION} caracteres`,
  })
  observacion?: string;
}
