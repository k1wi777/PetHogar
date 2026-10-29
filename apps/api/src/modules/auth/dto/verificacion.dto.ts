import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CorreoNormalizado } from './decoradores';

export class VerificarCorreoQueryDto {
  @IsString({ message: 'El enlace de verificación no es válido' })
  @IsNotEmpty({ message: 'El enlace de verificación no es válido' })
  @MaxLength(200, { message: 'El enlace de verificación no es válido' })
  token!: string;
}

export class ReenviarVerificacionDto {
  @CorreoNormalizado()
  email!: string;
}
