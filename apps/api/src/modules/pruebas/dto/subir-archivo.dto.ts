import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
  CARPETAS,
  type CarpetaArchivo,
  type CategoriaArchivo,
} from '../../storage/storage.constants';

export class SubirArchivoDto {
  @IsIn(['imagen', 'documento'], { message: "La categoría debe ser 'imagen' o 'documento'" })
  categoria!: CategoriaArchivo;

  @ApiProperty({ enum: CARPETAS })
  @IsIn([...CARPETAS], { message: 'La carpeta de destino no es válida' })
  carpeta!: CarpetaArchivo;
}
