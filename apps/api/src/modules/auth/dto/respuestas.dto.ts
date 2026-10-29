import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { RolNombre } from '../../../common/auth/usuario-autenticado';
import { EstadoValidacion } from '../../fundaciones/entities/fundacion.enum';

export class MensajeDto {
  @ApiProperty()
  mensaje!: string;
}

export class RegistroFundacionRespuestaDto extends MensajeDto {
  @ApiProperty({ enum: EstadoValidacion })
  estadoValidacion!: EstadoValidacion;
}

export class FundacionPerfilDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  nombre!: string;

  @ApiProperty({ enum: EstadoValidacion })
  estadoValidacion!: EstadoValidacion;

  @ApiPropertyOptional({ nullable: true, description: 'Solo si fue rechazada' })
  observacionValidacion!: string | null;
}

export class AdoptantePerfilDto {
  @ApiProperty()
  primerNombre!: string;

  @ApiPropertyOptional({ nullable: true })
  segundoNombre!: string | null;

  @ApiProperty()
  primerApellido!: string;

  @ApiPropertyOptional({ nullable: true })
  segundoApellido!: string | null;
}

export class UsuarioPerfilDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  telefono!: string;

  @ApiProperty({ enum: ['adoptante', 'fundacion', 'administrador'] })
  rol!: RolNombre;

  @ApiPropertyOptional({ type: AdoptantePerfilDto, nullable: true })
  adoptante!: AdoptantePerfilDto | null;

  @ApiPropertyOptional({ type: FundacionPerfilDto, nullable: true })
  fundacion!: FundacionPerfilDto | null;
}

export class SesionRespuestaDto {
  @ApiProperty({ description: 'JWT de acceso; se guarda solo en memoria del cliente' })
  accessToken!: string;

  @ApiProperty({ description: 'Segundos de vigencia del access token' })
  expiresIn!: number;

  @ApiProperty({ type: UsuarioPerfilDto })
  usuario!: UsuarioPerfilDto;
}
