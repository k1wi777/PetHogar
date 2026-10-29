import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { RolNombre } from '../../../common/auth/usuario-autenticado';
import { EstadoValidacion } from '../../fundaciones/entities/fundacion.enum';

export class FundacionAdminResumenDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  nombre!: string;

  @ApiProperty()
  nit!: string;

  @ApiProperty()
  ciudad!: string;

  @ApiProperty({ enum: EstadoValidacion })
  estadoValidacion!: EstadoValidacion;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  fechaValidacion!: Date | null;
}

export class ContactoFundacionDto {
  @ApiProperty()
  email!: string;

  @ApiProperty()
  telefono!: string;
}

export class DocumentoFundacionDto {
  @ApiProperty({
    description: 'Endpoint de descarga; exige el access token en la cabecera Authorization',
  })
  url!: string;
}

export class FundacionAdminDetalleDto extends FundacionAdminResumenDto {
  @ApiProperty()
  direccion!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  descripcion!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  observacionValidacion!: string | null;

  @ApiProperty({ type: ContactoFundacionDto })
  contacto!: ContactoFundacionDto;

  @ApiProperty({ type: DocumentoFundacionDto })
  documento!: DocumentoFundacionDto;
}

export class FundacionesAdminPaginadoDto {
  @ApiProperty({ type: [FundacionAdminResumenDto] })
  data!: FundacionAdminResumenDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class UsuarioAdminDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  telefono!: string;

  @ApiProperty({ enum: ['adoptante', 'fundacion', 'administrador'] })
  rol!: RolNombre;

  @ApiProperty()
  activo!: boolean;

  @ApiProperty()
  emailVerificado!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  fechaCreacion!: Date;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Nombre del adoptante o de la fundación; null para administradores',
  })
  nombre!: string | null;
}

export class UsuariosAdminPaginadoDto {
  @ApiProperty({ type: [UsuarioAdminDto] })
  data!: UsuarioAdminDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}
