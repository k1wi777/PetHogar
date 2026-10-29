import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { PaginacionQueryDto } from '../../../common/pagination/paginacion-query.dto';
import { EstadoValidacion } from '../../fundaciones/entities/fundacion.enum';

export class ConsultaFundacionesDto extends PaginacionQueryDto {
  @ApiPropertyOptional({
    enum: EstadoValidacion,
    default: EstadoValidacion.Pendiente,
    description: 'Estado de validación; por defecto, las pendientes',
  })
  @IsEnum(EstadoValidacion, {
    message: 'El estado debe ser pendiente, aprobada o rechazada',
  })
  estado: EstadoValidacion = EstadoValidacion.Pendiente;
}
