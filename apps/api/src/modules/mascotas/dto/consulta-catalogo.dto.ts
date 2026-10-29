import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Length, Max, Min, ValidateBy } from 'class-validator';
import { PaginacionQueryDto } from '../../../common/pagination/paginacion-query.dto';
import { ID_MAXIMO } from '../../../common/pipes/id-entero.pipe';
import { EnteroEstricto } from '../../../common/validation/decoradores';
import { TamanoMascota } from '../entities/mascota.enum';
import { EDAD_MAXIMA_MESES } from './campos-mascota';

export const LIMITE_CATALOGO_POR_DEFECTO = 12;

/** Rango inclusivo: un mínimo mayor que el máximo es una consulta incoherente. */
const RangoCoherente = (): PropertyDecorator =>
  ValidateBy({
    name: 'rangoEdadCoherente',
    validator: {
      validate: (minimo: unknown, args) => {
        const { edadMaxMeses } = (args?.object ?? {}) as { edadMaxMeses?: unknown };
        return (
          typeof minimo !== 'number' || typeof edadMaxMeses !== 'number' || minimo <= edadMaxMeses
        );
      },
      defaultMessage: () => 'La edad mínima no puede ser mayor que la máxima',
    },
  });

/** Catálogo público: todos los filtros son opcionales y se combinan con AND. */
export class ConsultaCatalogoDto extends PaginacionQueryDto {
  @ApiPropertyOptional({ default: LIMITE_CATALOGO_POR_DEFECTO, maximum: 100 })
  override limit: number = LIMITE_CATALOGO_POR_DEFECTO;

  @ApiPropertyOptional({ description: 'Id de la especie (ver GET /especies)' })
  @IsOptional()
  @EnteroEstricto()
  @IsInt({ message: 'La especie debe ser un número entero' })
  @Min(1, { message: 'La especie no es válida' })
  @Max(ID_MAXIMO, { message: 'La especie no es válida' })
  especieId?: number;

  @ApiPropertyOptional({ enum: TamanoMascota })
  @IsOptional()
  @IsEnum(TamanoMascota, { message: 'El tamaño debe ser pequeño, mediano o grande' })
  tamano?: TamanoMascota;

  @ApiPropertyOptional({ minimum: 0, description: 'Edad mínima en meses (inclusive)' })
  @IsOptional()
  @EnteroEstricto()
  @IsInt({ message: 'La edad mínima debe ser un número entero de meses' })
  @Min(0, { message: 'La edad mínima no puede ser negativa' })
  @Max(EDAD_MAXIMA_MESES, { message: `La edad mínima no puede superar ${EDAD_MAXIMA_MESES} meses` })
  @RangoCoherente()
  edadMinMeses?: number;

  @ApiPropertyOptional({ minimum: 0, description: 'Edad máxima en meses (inclusive)' })
  @IsOptional()
  @EnteroEstricto()
  @IsInt({ message: 'La edad máxima debe ser un número entero de meses' })
  @Min(0, { message: 'La edad máxima no puede ser negativa' })
  @Max(EDAD_MAXIMA_MESES, { message: `La edad máxima no puede superar ${EDAD_MAXIMA_MESES} meses` })
  edadMaxMeses?: number;

  @ApiPropertyOptional({
    maxLength: 60,
    description: 'Ciudad de la fundación; no distingue mayúsculas ni tildes',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Ciudad inválida' })
  @Length(1, 60, { message: 'Ciudad inválida' })
  ciudad?: string;
}
