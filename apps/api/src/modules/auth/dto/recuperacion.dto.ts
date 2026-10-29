import { IsString, Matches } from 'class-validator';
import { ContrasenaSegura, CorreoNormalizado } from './decoradores';

export class SolicitarRecuperacionDto {
  @CorreoNormalizado()
  email!: string;
}

export class RestablecerContrasenaDto {
  @CorreoNormalizado()
  email!: string;

  @IsString({ message: 'El código debe tener 6 dígitos' })
  @Matches(/^\d{6}$/, { message: 'El código debe tener 6 dígitos' })
  codigo!: string;

  @ContrasenaSegura()
  nuevaContrasena!: string;
}
