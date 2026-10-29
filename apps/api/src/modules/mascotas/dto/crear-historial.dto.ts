import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateBy } from 'class-validator';
import { Recortar } from '../../../common/validation/decoradores';
import { TipoHistorialMedico } from '../entities/historial-medico.enum';
import { esFechaCalendario } from '../../../common/validation/fecha';

/** Fecha `YYYY-MM-DD` que exista en el calendario; que no sea futura lo decide el service. */
const EsFechaCalendario = (): PropertyDecorator =>
  ValidateBy({
    name: 'esFechaCalendario',
    validator: {
      validate: (valor: unknown) => typeof valor === 'string' && esFechaCalendario(valor),
      defaultMessage: () => 'La fecha debe ser una fecha real con formato AAAA-MM-DD',
    },
  });

export class CrearHistorialDto {
  @ApiProperty({ enum: TipoHistorialMedico })
  @IsEnum(TipoHistorialMedico, {
    message: 'El tipo debe ser vacuna, desparasitacion, cirugia o consulta',
  })
  tipo!: TipoHistorialMedico;

  @ApiProperty({ example: '2026-03-15', description: 'AAAA-MM-DD; no puede ser posterior a hoy' })
  @Recortar()
  @EsFechaCalendario()
  fecha!: string;

  @ApiProperty({ maxLength: 300 })
  @Recortar()
  @IsString({ message: 'La descripción debe ser un texto' })
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @MaxLength(300, { message: 'La descripción no puede superar 300 caracteres' })
  descripcion!: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true, type: String })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsString({ message: 'El veterinario debe ser un texto' })
  @MaxLength(100, { message: 'El veterinario no puede superar 100 caracteres' })
  veterinario?: string | null;
}
