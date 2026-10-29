import { ApiProperty } from '@nestjs/swagger';

class FiltrosAplicadosDto {
  @ApiProperty({ type: Number, nullable: true })
  fundacionId!: number | null;

  @ApiProperty({ type: String, nullable: true, example: '2026-10-01' })
  desde!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '2026-10-31' })
  hasta!: string | null;
}

class CantidadPorMesDto {
  @ApiProperty({ example: '2026-10' })
  mes!: string;

  @ApiProperty()
  cantidad!: number;
}

class MontoPorMesDto extends CantidadPorMesDto {
  @ApiProperty({ example: '150000.00', description: 'Suma de las donaciones económicas' })
  monto!: string;
}

class CantidadPorEspecieDto {
  @ApiProperty({ example: 'perro' })
  especie!: string;

  @ApiProperty()
  cantidad!: number;
}

class AdopcionesEstadisticasDto {
  @ApiProperty()
  total!: number;

  @ApiProperty({ type: [CantidadPorMesDto] })
  porMes!: CantidadPorMesDto[];

  @ApiProperty({ type: [CantidadPorEspecieDto] })
  porEspecie!: CantidadPorEspecieDto[];
}

class PorEstadoSolicitudDto {
  @ApiProperty() pendiente!: number;
  @ApiProperty() aprobada!: number;
  @ApiProperty() rechazada!: number;
  @ApiProperty() cancelada!: number;
}

class SolicitudesEstadisticasDto {
  @ApiProperty()
  total!: number;

  @ApiProperty({ type: PorEstadoSolicitudDto })
  porEstado!: PorEstadoSolicitudDto;
}

class PorEstadoSeguimientoDto {
  @ApiProperty() programado!: number;
  @ApiProperty() realizado!: number;
  @ApiProperty() vencido!: number;
  @ApiProperty() cancelado!: number;
}

class PorBienestarDto {
  @ApiProperty() bueno!: number;
  @ApiProperty() regular!: number;
  @ApiProperty() malo!: number;
}

class SeguimientosEstadisticasDto {
  @ApiProperty()
  total!: number;

  @ApiProperty({ type: PorEstadoSeguimientoDto })
  porEstado!: PorEstadoSeguimientoDto;

  @ApiProperty({ type: PorBienestarDto, description: 'Solo los seguimientos con valoración' })
  porBienestar!: PorBienestarDto;
}

class TotalEconomicaDto {
  @ApiProperty() cantidad!: number;

  @ApiProperty({ example: '150000.00' })
  monto!: string;
}

class TotalEspecieDto {
  @ApiProperty() cantidad!: number;
}

class DonacionesPorTipoDto {
  @ApiProperty({ type: TotalEconomicaDto })
  economica!: TotalEconomicaDto;

  @ApiProperty({ type: TotalEspecieDto })
  especie!: TotalEspecieDto;
}

class DonacionesEstadisticasDto {
  @ApiProperty()
  total!: number;

  @ApiProperty({ type: [MontoPorMesDto] })
  porMes!: MontoPorMesDto[];

  @ApiProperty({ type: DonacionesPorTipoDto })
  porTipo!: DonacionesPorTipoDto;
}

export class EstadisticasDto {
  @ApiProperty({ type: FiltrosAplicadosDto })
  filtros!: FiltrosAplicadosDto;

  @ApiProperty({ type: AdopcionesEstadisticasDto })
  adopciones!: AdopcionesEstadisticasDto;

  @ApiProperty({ type: SolicitudesEstadisticasDto })
  solicitudes!: SolicitudesEstadisticasDto;

  @ApiProperty({ type: SeguimientosEstadisticasDto })
  seguimientos!: SeguimientosEstadisticasDto;

  @ApiProperty({ type: DonacionesEstadisticasDto })
  donaciones!: DonacionesEstadisticasDto;
}
