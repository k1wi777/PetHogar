import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginacionQueryDto } from '../../../common/pagination/paginacion-query.dto';
import { EstadoMascota } from '../entities/mascota.enum';

export class ConsultaMascotasFundacionDto extends PaginacionQueryDto {
  @ApiPropertyOptional({ enum: EstadoMascota, description: 'Filtra por estado' })
  @IsOptional()
  @IsEnum(EstadoMascota, {
    message: 'El estado debe ser disponible, en_proceso, adoptada o inactiva',
  })
  estado?: EstadoMascota;
}
