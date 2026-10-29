import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginacionQueryDto } from '../../../common/pagination/paginacion-query.dto';
import { ID_MAXIMO } from '../../../common/pipes/id-entero.pipe';
import { EnteroEstricto } from '../../../common/validation/decoradores';
import { EstadoSeguimiento, TipoSeguimiento } from '../entities/seguimiento.enum';

export class ConsultaSeguimientosDto extends PaginacionQueryDto {
  @ApiPropertyOptional({ enum: EstadoSeguimiento, description: 'Filtra por estado' })
  @IsOptional()
  @IsEnum(EstadoSeguimiento, {
    message: 'El estado debe ser programado, realizado, vencido o cancelado',
  })
  estado?: EstadoSeguimiento;

  @ApiPropertyOptional({ enum: TipoSeguimiento, description: 'Filtra por tipo' })
  @IsOptional()
  @IsEnum(TipoSeguimiento, { message: 'El tipo debe ser visita o reporte' })
  tipo?: TipoSeguimiento;

  @ApiPropertyOptional({ description: 'Filtra por adopción' })
  @IsOptional()
  @EnteroEstricto()
  @IsInt({ message: 'La adopción debe ser un número entero' })
  @Min(1, { message: 'La adopción no es válida' })
  @Max(ID_MAXIMO, { message: 'La adopción no es válida' })
  adopcionId?: number;
}
