import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginacionQueryDto } from '../../../common/pagination/paginacion-query.dto';
import { ID_MAXIMO } from '../../../common/pipes/id-entero.pipe';
import { EnteroEstricto } from '../../../common/validation/decoradores';
import { EstadoSolicitud } from '../entities/solicitud-adopcion.enum';

const MENSAJE_ESTADO = 'El estado debe ser pendiente, aprobada, rechazada o cancelada';

export class ConsultaMisSolicitudesDto extends PaginacionQueryDto {
  @ApiPropertyOptional({ enum: EstadoSolicitud, description: 'Filtra por estado' })
  @IsOptional()
  @IsEnum(EstadoSolicitud, { message: MENSAJE_ESTADO })
  estado?: EstadoSolicitud;
}

export class ConsultaSolicitudesFundacionDto extends ConsultaMisSolicitudesDto {
  @ApiPropertyOptional({ description: 'Filtra por mascota' })
  @IsOptional()
  @EnteroEstricto()
  @IsInt({ message: 'La mascota debe ser un número entero' })
  @Min(1, { message: 'La mascota no es válida' })
  @Max(ID_MAXIMO, { message: 'La mascota no es válida' })
  mascotaId?: number;
}
