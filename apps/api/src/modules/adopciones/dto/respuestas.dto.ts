import { ApiProperty } from '@nestjs/swagger';
import {
  AdoptanteContactoDto,
  EnlaceDescargaDto,
  MascotaResumenDto,
  SolicitudDetalleFundacionDto,
} from '../../solicitudes/dto/respuestas.dto';
import { EstadoAdopcion } from '../entities/adopcion.enum';

class AdopcionBaseDto {
  @ApiProperty()
  id!: number;

  @ApiProperty({ example: '2026-11-20' })
  fechaEntrega!: string;

  @ApiProperty({ enum: EstadoAdopcion })
  estado!: EstadoAdopcion;

  @ApiProperty()
  solicitudId!: number;

  @ApiProperty({ type: MascotaResumenDto })
  mascota!: MascotaResumenDto;

  @ApiProperty({ type: EnlaceDescargaDto, nullable: true, description: 'Acta firmada, si existe' })
  acta!: EnlaceDescargaDto | null;

  @ApiProperty({ type: [Object], description: 'Vacío hasta que existan los seguimientos' })
  seguimientos!: never[];
}

export class FundacionContactoDto {
  @ApiProperty()
  nombre!: string;

  @ApiProperty()
  ciudad!: string;
}

export class AdopcionAdoptanteDto extends AdopcionBaseDto {
  @ApiProperty({ type: FundacionContactoDto })
  fundacion!: FundacionContactoDto;
}

export class AdopcionFundacionDto extends AdopcionBaseDto {
  @ApiProperty({ type: AdoptanteContactoDto })
  adoptante!: AdoptanteContactoDto;
}

class PaginadoDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class AdopcionesAdoptantePaginadoDto extends PaginadoDto {
  @ApiProperty({ type: [AdopcionAdoptanteDto] })
  data!: AdopcionAdoptanteDto[];
}

export class AdopcionesFundacionPaginadoDto extends PaginadoDto {
  @ApiProperty({ type: [AdopcionFundacionDto] })
  data!: AdopcionFundacionDto[];
}

export class ResumenAdopcionDto {
  @ApiProperty()
  id!: number;

  @ApiProperty({ example: '2026-11-20' })
  fechaEntrega!: string;

  @ApiProperty({ enum: EstadoAdopcion })
  estado!: EstadoAdopcion;
}

/** Resultado de decidir: la solicitud actualizada y, si se aprobó, la adopción creada. */
export class DecisionResultadoDto extends SolicitudDetalleFundacionDto {
  @ApiProperty({ type: ResumenAdopcionDto, nullable: true })
  adopcion!: ResumenAdopcionDto | null;
}
