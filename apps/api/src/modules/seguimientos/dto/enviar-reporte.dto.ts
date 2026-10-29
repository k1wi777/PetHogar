import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Recortar } from '../../../common/validation/decoradores';
import { MAX_TEXTO } from '../seguimientos.constants';

/** Cuerpo multipart: los comentarios van como texto, junto a hasta 5 archivos en `fotos`. */
export class EnviarReporteDto {
  @ApiProperty({ maxLength: MAX_TEXTO, description: 'Cómo está la mascota' })
  @Recortar()
  @IsString({ message: 'Los comentarios deben ser un texto' })
  @IsNotEmpty({ message: 'Cuéntanos cómo está la mascota' })
  @MaxLength(MAX_TEXTO, {
    message: `Los comentarios no pueden superar ${MAX_TEXTO} caracteres`,
  })
  comentarios!: string;
}
