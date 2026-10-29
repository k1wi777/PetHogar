import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginacionQueryDto } from '../../../common/pagination/paginacion-query.dto';
import { EstadoAdopcion } from '../entities/adopcion.enum';

export class ConsultaAdopcionesDto extends PaginacionQueryDto {
  @ApiPropertyOptional({ enum: EstadoAdopcion, description: 'Filtra por estado' })
  @IsOptional()
  @IsEnum(EstadoAdopcion, { message: 'El estado debe ser activa, finalizada o revocada' })
  estado?: EstadoAdopcion;
}
