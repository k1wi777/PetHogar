import { z } from 'zod';
import { correo } from './comunes';

/** Sin política de fortaleza: endurecerla bloquearía cuentas antiguas (igual que el backend). */
export const esquemaLogin = z.object({
  email: correo,
  contrasena: z
    .string({ error: 'Ingresa tu contraseña' })
    .min(1, 'Ingresa tu contraseña')
    .max(128, 'La contraseña no es válida'),
});

export type DatosLogin = z.infer<typeof esquemaLogin>;
