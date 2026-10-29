import { ApiProperty } from '@nestjs/swagger';

export class EspecieDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  nombre!: string;
}

export class RazaDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  nombre!: string;
}
