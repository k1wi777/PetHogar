import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { Recortar } from '../../../common/validation/decoradores';
import { TipoSeguimiento } from '../entities/seguimiento.enum';
import { EsFechaReal } from './campos';

export class ProgramarSeguimientoDto {
  @ApiProperty({ enum: TipoSeguimiento })
  @IsEnum(TipoSeguimiento, { message: 'El tipo debe ser visita o reporte' })
  tipo!: TipoSeguimiento;

  @ApiProperty({
    example: '2026-12-15',
    description: 'AAAA-MM-DD; posterior a la fecha de entrega y no anterior a hoy',
  })
  @Recortar()
  @IsNotEmpty({ message: 'Debes indicar la fecha del seguimiento' })
  @EsFechaReal('La fecha del seguimiento debe ser una fecha real con formato AAAA-MM-DD')
  fechaProgramada!: string;
}
