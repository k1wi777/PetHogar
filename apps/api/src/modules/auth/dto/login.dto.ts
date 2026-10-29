import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CorreoNormalizado } from './decoradores';

export class LoginDto {
  @CorreoNormalizado()
  email!: string;

  /** Sin política de fortaleza: solo se compara; el tope evita trabajo inútil con entradas enormes. */
  @IsString({ message: 'Ingresa tu contraseña' })
  @IsNotEmpty({ message: 'Ingresa tu contraseña' })
  @MaxLength(128, { message: 'La contraseña no es válida' })
  contrasena!: string;
}
