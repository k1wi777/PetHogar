import { z } from 'zod';
import { contrasenaSegura, correo } from './comunes';

export const esquemaSolicitudCodigo = z.object({ email: correo });

export const esquemaCodigo = z.object({
  codigo: z
    .string({ error: 'El código debe tener 6 dígitos' })
    .trim()
    .regex(/^\d{6}$/, 'El código debe tener 6 dígitos'),
});

export const esquemaNuevaContrasena = z.object({ nuevaContrasena: contrasenaSegura });

export type DatosCorreo = z.infer<typeof esquemaSolicitudCodigo>;
export type DatosCodigo = z.infer<typeof esquemaCodigo>;
export type DatosNuevaContrasena = z.infer<typeof esquemaNuevaContrasena>;
