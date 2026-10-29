import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginacionQueryDto } from '../../../common/pagination/paginacion-query.dto';
import { BooleanoEstricto } from '../../../common/validation/decoradores';

export class ConsultaNotificacionesDto extends PaginacionQueryDto {
  @ApiPropertyOptional({ description: 'true: solo leídas; false: solo no leídas' })
  @IsOptional()
  @BooleanoEstricto()
  @IsBoolean({ message: 'El filtro de lectura debe ser true o false' })
  leida?: boolean;
}
