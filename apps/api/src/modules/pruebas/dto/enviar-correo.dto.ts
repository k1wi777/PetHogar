import { IsEmail } from 'class-validator';

export class EnviarCorreoDto {
  @IsEmail({}, { message: 'El destinatario debe ser un correo válido' })
  destinatario!: string;
}
