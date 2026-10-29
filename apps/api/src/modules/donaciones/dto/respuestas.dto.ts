import { ApiProperty } from '@nestjs/swagger';
import { TipoDonacion } from '../entities/donacion.enum';

class FundacionDonadaDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  nombre!: string;
}

export class DonacionResumenDto {
  @ApiProperty()
  id!: number;

  @ApiProperty({ type: FundacionDonadaDto })
  fundacion!: FundacionDonadaDto;

  @ApiProperty({ enum: TipoDonacion })
  tipo!: TipoDonacion;

  @ApiProperty({ type: String, nullable: true, example: '50000.00' })
  monto!: string | null;

  @ApiProperty({ type: String, nullable: true })
  descripcionEspecie!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  fecha!: Date;

  @ApiProperty({ description: 'Indica si se adjuntó comprobante' })
  comprobante!: boolean;
}

class DonanteDto {
  @ApiProperty()
  nombre!: string;

  @ApiProperty({ enum: ['plataforma', 'manual'] })
  origen!: 'plataforma' | 'manual';
}

class EnlaceComprobanteDto {
  @ApiProperty({ example: '/api/fundacion/donaciones/1/comprobante' })
  url!: string;
}

export class DonacionFundacionDto {
  @ApiProperty()
  id!: number;

  @ApiProperty({ enum: TipoDonacion })
  tipo!: TipoDonacion;

  @ApiProperty({ type: String, nullable: true, example: '50000.00' })
  monto!: string | null;

  @ApiProperty({ type: String, nullable: true })
  descripcionEspecie!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  fecha!: Date;

  @ApiProperty({ type: DonanteDto })
  donante!: DonanteDto;

  @ApiProperty({ type: EnlaceComprobanteDto, nullable: true })
  comprobante!: EnlaceComprobanteDto | null;
}

class TotalEconomicasDto {
  @ApiProperty()
  cantidad!: number;

  @ApiProperty({ example: '1500.50', description: 'Cadena con 2 decimales' })
  monto!: string;
}

class TotalEspecieDto {
  @ApiProperty()
  cantidad!: number;
}

class TotalesDto {
  @ApiProperty({ type: TotalEconomicasDto })
  economica!: TotalEconomicasDto;

  @ApiProperty({ type: TotalEspecieDto })
  especie!: TotalEspecieDto;
}

export class DonacionesFundacionPaginadoDto {
  @ApiProperty({ type: [DonacionFundacionDto] })
  data!: DonacionFundacionDto[];

  @ApiProperty({ description: 'Total de donaciones del filtro (no solo de la página)' })
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty({
    type: TotalesDto,
    description: 'Suma de TODO el conjunto filtrado por periodo y tipo, no solo de la página',
  })
  totales!: TotalesDto;
}
