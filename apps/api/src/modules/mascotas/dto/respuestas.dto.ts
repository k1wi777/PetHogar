import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoHistorialMedico } from '../entities/historial-medico.enum';
import { EstadoMascota, SexoMascota, TamanoMascota } from '../entities/mascota.enum';

/** Mascota vista por su fundación dueña. */
export class MascotaGestionDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  razaId!: number;

  @ApiProperty()
  nombre!: string;

  @ApiProperty({ enum: SexoMascota })
  sexo!: SexoMascota;

  @ApiProperty({ description: 'Edad en meses' })
  edadMeses!: number;

  @ApiProperty({ enum: TamanoMascota })
  tamano!: TamanoMascota;

  @ApiPropertyOptional({ nullable: true, type: String })
  color!: string | null;

  @ApiProperty()
  esterilizado!: boolean;

  @ApiProperty()
  vacunado!: boolean;

  @ApiProperty()
  estadoSalud!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  descripcion!: string | null;

  @ApiProperty({ enum: EstadoMascota })
  estado!: EstadoMascota;

  @ApiProperty({ type: String, format: 'date-time' })
  fechaPublicacion!: Date;
}

export class MascotasGestionPaginadoDto {
  @ApiProperty({ type: [MascotaGestionDto] })
  data!: MascotaGestionDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class FotoGestionDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  esPrincipal!: boolean;

  @ApiPropertyOptional({ nullable: true, type: String, description: 'Miniatura del catálogo' })
  urlCatalogo!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, description: 'Versión grande' })
  url!: string | null;
}

export class MascotaGestionDetalleDto extends MascotaGestionDto {
  @ApiProperty({ type: [FotoGestionDto], description: 'Principal primero' })
  fotos!: FotoGestionDto[];
}

export class EventoMedicoDto {
  @ApiProperty()
  id!: number;

  @ApiProperty({ enum: TipoHistorialMedico })
  tipo!: TipoHistorialMedico;

  @ApiProperty({ example: '2026-03-15', description: 'AAAA-MM-DD' })
  fecha!: string;

  @ApiProperty()
  descripcion!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  veterinario!: string | null;
}

export class FotoPublicaDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  esPrincipal!: boolean;

  @ApiPropertyOptional({ nullable: true, type: String, description: 'Miniatura del catálogo' })
  urlCatalogo!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, description: 'Versión grande' })
  url!: string | null;
}

export class FotoPrincipalDto {
  @ApiProperty()
  urlCatalogo!: string;
}

export class FundacionResumenPublicaDto {
  @ApiProperty()
  nombre!: string;
}

/** Datos públicos de la fundación; no incluyen correo, NIT, documento, teléfono ni dirección. */
export class FundacionPublicaDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  nombre!: string;

  @ApiProperty()
  ciudad!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  descripcion!: string | null;
}

export class MascotaCatalogoDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  nombre!: string;

  @ApiProperty({ example: 'perro' })
  especie!: string;

  @ApiProperty()
  raza!: string;

  @ApiProperty({ enum: SexoMascota })
  sexo!: SexoMascota;

  @ApiProperty({ description: 'Edad en meses' })
  edadMeses!: number;

  @ApiProperty({ enum: TamanoMascota })
  tamano!: TamanoMascota;

  @ApiProperty({ description: 'Ciudad de la fundación' })
  ciudad!: string;

  @ApiProperty({ type: FundacionResumenPublicaDto })
  fundacion!: FundacionResumenPublicaDto;

  @ApiPropertyOptional({ nullable: true, type: FotoPrincipalDto })
  fotoPrincipal!: FotoPrincipalDto | null;
}

export class MascotasCatalogoPaginadoDto {
  @ApiProperty({ type: [MascotaCatalogoDto] })
  data!: MascotaCatalogoDto[];

  @ApiProperty({ description: 'Total de mascotas que cumplen los filtros (0 si no hay)' })
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class MascotaFichaDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  nombre!: string;

  @ApiProperty()
  especie!: string;

  @ApiProperty()
  raza!: string;

  @ApiProperty({ enum: SexoMascota })
  sexo!: SexoMascota;

  @ApiProperty({ description: 'Edad en meses' })
  edadMeses!: number;

  @ApiProperty({ enum: TamanoMascota })
  tamano!: TamanoMascota;

  @ApiPropertyOptional({ nullable: true, type: String })
  color!: string | null;

  @ApiProperty()
  esterilizado!: boolean;

  @ApiProperty()
  vacunado!: boolean;

  @ApiProperty()
  estadoSalud!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  descripcion!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  fechaPublicacion!: Date;

  @ApiProperty({ type: FundacionPublicaDto })
  fundacion!: FundacionPublicaDto;

  @ApiProperty({ type: [FotoPublicaDto], description: 'Principal primero' })
  fotos!: FotoPublicaDto[];

  @ApiProperty({ type: [EventoMedicoDto], description: 'Más reciente primero' })
  historial!: EventoMedicoDto[];
}
