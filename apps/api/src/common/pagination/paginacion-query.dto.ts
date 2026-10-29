import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export const LIMITE_POR_DEFECTO = 10;
export const LIMITE_MAXIMO = 100;
/** Tope de página: un valor astronómico produciría un OFFSET inválido en Postgres (error 500). */
export const PAGINA_MAXIMA = 1_000_000;

export class PaginacionQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, description: 'Número de página' })
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página debe ser mayor o igual a 1' })
  @Max(PAGINA_MAXIMA, { message: `La página no puede superar ${PAGINA_MAXIMA}` })
  page: number = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: LIMITE_MAXIMO,
    default: LIMITE_POR_DEFECTO,
    description: 'Elementos por página',
  })
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite debe ser mayor o igual a 1' })
  @Max(LIMITE_MAXIMO, { message: `El límite no puede superar ${LIMITE_MAXIMO}` })
  limit: number = LIMITE_POR_DEFECTO;
}
