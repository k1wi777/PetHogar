import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, MaxLength, ValidateBy, ValidateIf } from 'class-validator';
import { esFechaCalendario, hoyEnBogota } from '../../../common/validation/fecha';
import { Recortar } from '../../../common/validation/decoradores';

export enum TipoDecision {
  Aprobar = 'aprobar',
  Rechazar = 'rechazar',
}

export const MAX_OBSERVACION = 300;

type Cuerpo = Partial<DecisionSolicitudDto>;
const rechaza = (o: Cuerpo): boolean => o.decision === TipoDecision.Rechazar;
const aprueba = (o: Cuerpo): boolean => o.decision === TipoDecision.Aprobar;

/** Fecha `YYYY-MM-DD` real; los valores ausentes los reporta `@IsNotEmpty`, no este validador. */
const EsFechaReal = (): PropertyDecorator =>
  ValidateBy({
    name: 'esFechaReal',
    validator: {
      validate: (valor: unknown) =>
        valor === undefined ||
        valor === null ||
        valor === '' ||
        (typeof valor === 'string' && esFechaCalendario(valor)),
      defaultMessage: () => 'La fecha de entrega debe ser una fecha real con formato AAAA-MM-DD',
    },
  });

/** «Hoy» es el día de Bogotá (el servidor puede estar en UTC): entregar hoy es válido. */
const NoAnteriorAHoy = (): PropertyDecorator =>
  ValidateBy({
    name: 'noAnteriorAHoy',
    validator: {
      validate: (valor: unknown) =>
        typeof valor !== 'string' || !esFechaCalendario(valor) || valor >= hoyEnBogota(new Date()),
      defaultMessage: () => 'La fecha de entrega no puede ser anterior a hoy',
    },
  });

export class DecisionSolicitudDto {
  @ApiProperty({ enum: TipoDecision })
  @IsEnum(TipoDecision, { message: 'La decisión debe ser aprobar o rechazar' })
  decision!: TipoDecision;

  @ApiPropertyOptional({
    maxLength: MAX_OBSERVACION,
    description: 'Obligatoria al rechazar; opcional al aprobar',
  })
  // Al aprobar, una observación en blanco equivale a no enviarla.
  @Transform(({ value, obj }: { value: unknown; obj: Cuerpo }) => {
    const texto = typeof value === 'string' ? value.trim() : value;
    return texto === '' && !rechaza(obj) ? undefined : texto;
  })
  @ValidateIf((o: Cuerpo) => rechaza(o) || o.observacion !== undefined)
  @IsString({ message: 'La observación debe ser un texto' })
  @IsNotEmpty({ message: 'Debes indicar el motivo del rechazo' })
  @MaxLength(MAX_OBSERVACION, {
    message: `La observación no puede superar ${MAX_OBSERVACION} caracteres`,
  })
  observacion?: string;

  @ApiPropertyOptional({
    example: '2026-11-20',
    description: 'AAAA-MM-DD, hoy o posterior; obligatoria al aprobar y ignorada al rechazar',
  })
  @Recortar()
  @ValidateIf(aprueba)
  @IsNotEmpty({ message: 'Debes indicar la fecha de entrega' })
  @EsFechaReal()
  @NoAnteriorAHoy()
  fechaEntrega?: string;
}
