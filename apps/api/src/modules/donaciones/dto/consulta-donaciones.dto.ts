import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, ValidateBy } from 'class-validator';
import { PaginacionQueryDto } from '../../../common/pagination/paginacion-query.dto';
import { Recortar } from '../../../common/validation/decoradores';
import { esFechaCalendario } from '../../../common/validation/fecha';
import { TipoDonacion } from '../entities/donacion.enum';

const EsFecha = (mensaje: string): PropertyDecorator =>
  ValidateBy({
    name: 'esFechaCalendario',
    validator: {
      validate: (valor: unknown) => typeof valor === 'string' && esFechaCalendario(valor),
      defaultMessage: () => mensaje,
    },
  });

export class ConsultaDonacionesDto extends PaginacionQueryDto {
  @ApiPropertyOptional({
    example: '2026-10-01',
    description: 'Primer día del periodo (AAAA-MM-DD, hora de Bogotá), incluido',
  })
  @IsOptional()
  @Recortar()
  @IsString({ message: 'La fecha inicial debe ser una fecha real con formato AAAA-MM-DD' })
  @EsFecha('La fecha inicial debe ser una fecha real con formato AAAA-MM-DD')
  desde?: string;

  @ApiPropertyOptional({
    example: '2026-10-31',
    description: 'Último día del periodo (AAAA-MM-DD, hora de Bogotá), incluido',
  })
  @IsOptional()
  @Recortar()
  @IsString({ message: 'La fecha final debe ser una fecha real con formato AAAA-MM-DD' })
  @EsFecha('La fecha final debe ser una fecha real con formato AAAA-MM-DD')
  hasta?: string;

  @ApiPropertyOptional({ enum: TipoDonacion })
  @IsOptional()
  @IsEnum(TipoDonacion, { message: 'El tipo debe ser economica o especie' })
  tipo?: TipoDonacion;
}
