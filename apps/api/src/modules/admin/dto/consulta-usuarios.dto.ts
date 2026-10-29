import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ROLES_NOMBRES, type RolNombre } from '../../../common/auth/usuario-autenticado';
import { PaginacionQueryDto } from '../../../common/pagination/paginacion-query.dto';
import { Recortar } from '../../auth/dto/decoradores';

export class ConsultaUsuariosDto extends PaginacionQueryDto {
  @ApiPropertyOptional({ description: 'Nombre del adoptante o de la fundación (contiene)' })
  @IsOptional()
  @Recortar()
  @IsString({ message: 'El nombre debe ser un texto' })
  @MaxLength(100, { message: 'El nombre no puede superar los 100 caracteres' })
  nombre?: string;

  @ApiPropertyOptional({ description: 'Correo (contiene)' })
  @IsOptional()
  @Recortar()
  @IsString({ message: 'El correo debe ser un texto' })
  @MaxLength(100, { message: 'El correo no puede superar los 100 caracteres' })
  correo?: string;

  @ApiPropertyOptional({ enum: ROLES_NOMBRES })
  @IsOptional()
  @IsIn(ROLES_NOMBRES, { message: 'El rol debe ser adoptante, fundacion o administrador' })
  rol?: RolNombre;
}
