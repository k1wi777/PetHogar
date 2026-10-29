import { ApiProperty } from '@nestjs/swagger';

export class ReferenciaNotificacionDto {
  @ApiProperty({
    example: 'solicitud',
    description: 'solicitud, seguimiento, fundacion, donacion o adopcion',
  })
  tipo!: string;

  @ApiProperty()
  id!: number;
}

export class NotificacionDto {
  @ApiProperty()
  id!: number;

  @ApiProperty({ example: 'solicitud' })
  tipo!: string;

  @ApiProperty()
  titulo!: string;

  @ApiProperty({ description: 'Texto plano: el cliente debe mostrarlo sin interpretar HTML' })
  mensaje!: string;

  @ApiProperty()
  leida!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  fechaCreacion!: Date;

  @ApiProperty({ type: ReferenciaNotificacionDto, nullable: true })
  referencia!: ReferenciaNotificacionDto | null;
}

export class NotificacionesPaginadoDto {
  @ApiProperty({ type: [NotificacionDto] })
  data!: NotificacionDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class NoLeidasDto {
  @ApiProperty()
  noLeidas!: number;
}

export class ActualizadasDto {
  @ApiProperty()
  actualizadas!: number;
}
