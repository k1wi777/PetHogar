import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoSolicitud } from '../entities/solicitud-adopcion.enum';

export class MascotaResumenDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  nombre!: string;
}

export class EnlaceDescargaDto {
  @ApiProperty({
    example: '/api/mis-solicitudes/1/formulario',
    description: 'Descarga autenticada',
  })
  url!: string;
}

export class FundacionNombreDto {
  @ApiProperty()
  nombre!: string;
}

export class AdoptanteNombreDto {
  @ApiProperty()
  nombreCompleto!: string;
}

export class AdoptanteContactoDto extends AdoptanteNombreDto {
  @ApiProperty()
  email!: string;

  @ApiProperty()
  telefono!: string;

  @ApiProperty()
  ciudad!: string;
}

class CabeceraDto {
  @ApiProperty()
  id!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  fechaSolicitud!: Date;

  @ApiProperty({ enum: EstadoSolicitud })
  estado!: EstadoSolicitud;

  @ApiProperty({ type: MascotaResumenDto })
  mascota!: MascotaResumenDto;
}

class DatosSolicitudDto extends CabeceraDto {
  @ApiProperty()
  motivo!: string;

  @ApiProperty({ example: 'casa' })
  tipoVivienda!: string;

  @ApiProperty()
  tieneOtrasMascotas!: boolean;

  @ApiPropertyOptional({ nullable: true, type: String, description: 'Observación de la fundación' })
  observacion!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  fechaRespuesta!: Date | null;

  @ApiProperty({ type: EnlaceDescargaDto })
  formulario!: EnlaceDescargaDto;
}

export class SolicitudResumenAdoptanteDto extends CabeceraDto {
  @ApiProperty({ type: FundacionNombreDto })
  fundacion!: FundacionNombreDto;
}

export class SolicitudDetalleAdoptanteDto extends DatosSolicitudDto {
  @ApiProperty({ type: FundacionNombreDto })
  fundacion!: FundacionNombreDto;
}

export class SolicitudResumenFundacionDto extends CabeceraDto {
  @ApiProperty({ type: AdoptanteNombreDto })
  adoptante!: AdoptanteNombreDto;
}

export class SolicitudDetalleFundacionDto extends DatosSolicitudDto {
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

export class SolicitudesAdoptantePaginadoDto extends PaginadoDto {
  @ApiProperty({ type: [SolicitudResumenAdoptanteDto] })
  data!: SolicitudResumenAdoptanteDto[];
}

export class SolicitudesFundacionPaginadoDto extends PaginadoDto {
  @ApiProperty({ type: [SolicitudResumenFundacionDto] })
  data!: SolicitudResumenFundacionDto[];
}
