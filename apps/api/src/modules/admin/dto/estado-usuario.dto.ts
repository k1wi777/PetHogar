import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { BooleanoEstricto } from '../../auth/dto/decoradores';

export class EstadoUsuarioDto {
  @ApiProperty({
    description: '`true` activa la cuenta; `false` la desactiva y cierra sus sesiones',
  })
  @BooleanoEstricto()
  @IsBoolean({ message: 'El estado debe ser verdadero o falso' })
  activo!: boolean;
}
