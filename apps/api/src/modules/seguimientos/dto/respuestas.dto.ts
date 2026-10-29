import { ApiProperty } from '@nestjs/swagger';
import {
  AdoptanteNombreDto,
  FundacionNombreDto,
  MascotaResumenDto,
} from '../../solicitudes/dto/respuestas.dto';
import { EstadoBienestar, EstadoSeguimiento, TipoSeguimiento } from '../entities/seguimiento.enum';

export class FotoSeguimientoDto {
  @ApiProperty()
  id!: number;

  @ApiProperty({
    example: '/api/fundacion/seguimientos/3/evidencias/9',
    description: 'Descarga autenticada; la clave de almacenamiento nunca se expone',
  })
  url!: string;
}

export class ReporteAdoptanteDto {
  @ApiProperty()
  comentarios!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  enviadoEn!: Date;

  @ApiProperty({ type: [FotoSeguimientoDto] })
  fotos!: FotoSeguimientoDto[];
}

export class ResumenSeguimientoDto {
  @ApiProperty()
  id!: number;

  @ApiProperty({ enum: TipoSeguimiento })
  tipo!: TipoSeguimiento;

  @ApiProperty({ example: '2026-12-15' })
  fechaProgramada!: string;

  @ApiProperty({ type: String, nullable: true, example: '2026-12-14' })
  fechaRealizada!: string | null;

  @ApiProperty({ enum: EstadoSeguimiento })
  estado!: EstadoSeguimiento;

  @ApiProperty({ description: 'Vencido por estado o por tener la fecha anterior a hoy' })
  vencido!: boolean;
}

class SeguimientoBaseDto extends ResumenSeguimientoDto {
  @ApiProperty()
  adopcionId!: number;

  @ApiProperty({ description: 'El adoptante ya envió su reporte' })
  tieneReporte!: boolean;

  @ApiProperty({ type: MascotaResumenDto })
  mascota!: MascotaResumenDto;
}

export class SeguimientoListaFundacionDto extends SeguimientoBaseDto {
  @ApiProperty({ type: AdoptanteNombreDto })
  adoptante!: AdoptanteNombreDto;
}

export class SeguimientoListaAdoptanteDto extends SeguimientoBaseDto {
  @ApiProperty({ type: FundacionNombreDto })
  fundacion!: FundacionNombreDto;
}

export class SeguimientoDetalleFundacionDto extends SeguimientoListaFundacionDto {
  @ApiProperty({ example: '2026-11-20' })
  fechaEntrega!: string;

  @ApiProperty({ enum: EstadoBienestar, nullable: true })
  estadoBienestar!: EstadoBienestar | null;

  @ApiProperty({ type: String, nullable: true })
  observaciones!: string | null;

  @ApiProperty({ type: ReporteAdoptanteDto, nullable: true })
  reporte!: ReporteAdoptanteDto | null;

  @ApiProperty({ type: [FotoSeguimientoDto], description: 'Fotos de la fundación al cerrar' })
  evidencias!: FotoSeguimientoDto[];
}

/** El adoptante no ve bienestar, observaciones ni evidencias de la fundación. */
export class SeguimientoDetalleAdoptanteDto extends SeguimientoListaAdoptanteDto {
  @ApiProperty({ example: '2026-11-20' })
  fechaEntrega!: string;

  @ApiProperty({ type: ReporteAdoptanteDto, nullable: true })
  reporte!: ReporteAdoptanteDto | null;
}

class PaginadoDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class SeguimientosFundacionPaginadoDto extends PaginadoDto {
  @ApiProperty({ type: [SeguimientoListaFundacionDto] })
  data!: SeguimientoListaFundacionDto[];
}

export class SeguimientosAdoptantePaginadoDto extends PaginadoDto {
  @ApiProperty({ type: [SeguimientoListaAdoptanteDto] })
  data!: SeguimientoListaAdoptanteDto[];
}
