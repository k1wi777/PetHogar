import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, ValidateBy } from 'class-validator';
import { EnteroEstricto, Recortar } from '../../../common/validation/decoradores';
import { esFechaCalendario } from '../../../common/validation/fecha';
import { MENSAJE_FECHA_FINAL, MENSAJE_FECHA_INICIAL } from '../reportes.constants';

const EsFecha = (mensaje: string): PropertyDecorator =>
  ValidateBy({
    name: 'esFechaCalendario',
    validator: {
      validate: (valor: unknown) => typeof valor === 'string' && esFechaCalendario(valor),
      defaultMessage: () => mensaje,
    },
  });

export class ConsultaPeriodoDto {
  @ApiPropertyOptional({
    example: '2026-10-01',
    description: 'Primer día del periodo (AAAA-MM-DD, hora de Bogotá), incluido',
  })
  @IsOptional()
  @Recortar()
  @IsString({ message: MENSAJE_FECHA_INICIAL })
  @EsFecha(MENSAJE_FECHA_INICIAL)
  desde?: string;

  @ApiPropertyOptional({
    example: '2026-10-31',
    description: 'Último día del periodo (AAAA-MM-DD, hora de Bogotá), incluido',
  })
  @IsOptional()
  @Recortar()
  @IsString({ message: MENSAJE_FECHA_FINAL })
  @EsFecha(MENSAJE_FECHA_FINAL)
  hasta?: string;
}

export class ConsultaEstadisticasAdminDto extends ConsultaPeriodoDto {
  @ApiPropertyOptional({ description: 'Limita las cifras a una fundación' })
  @IsOptional()
  @EnteroEstricto()
  @IsInt({ message: 'La fundación debe ser un número entero' })
  @Min(1, { message: 'La fundación debe ser un número entero positivo' })
  fundacionId?: number;
}
