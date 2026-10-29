import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { TipoDonacion } from '../../donaciones/entities/donacion.enum';
import { EstadoSeguimiento } from '../../seguimientos/entities/seguimiento.enum';
import { EstadoSolicitud } from '../../solicitudes/entities/solicitud-adopcion.enum';
import { ConsultaPeriodoDto } from './consulta-periodo.dto';

export class ConsultaReporteSolicitudesDto extends ConsultaPeriodoDto {
  @ApiPropertyOptional({ enum: EstadoSolicitud })
  @IsOptional()
  @IsEnum(EstadoSolicitud, {
    message: 'El estado debe ser pendiente, aprobada, rechazada o cancelada',
  })
  estado?: EstadoSolicitud;
}

export class ConsultaReporteSeguimientosDto extends ConsultaPeriodoDto {
  @ApiPropertyOptional({ enum: EstadoSeguimiento })
  @IsOptional()
  @IsEnum(EstadoSeguimiento, {
    message: 'El estado debe ser programado, realizado, vencido o cancelado',
  })
  estado?: EstadoSeguimiento;
}

export class ConsultaReporteDonacionesDto extends ConsultaPeriodoDto {
  @ApiPropertyOptional({ enum: TipoDonacion })
  @IsOptional()
  @IsEnum(TipoDonacion, { message: 'El tipo debe ser economica o especie' })
  tipo?: TipoDonacion;
}
