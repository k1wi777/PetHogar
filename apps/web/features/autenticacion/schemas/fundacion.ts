import { z } from 'zod';
import { validarDocumento } from '@/shared/lib/archivo';
import {
  aceptaPolitica,
  contrasenaSegura,
  correo,
  telefono,
  textoObligatorio,
  textoOpcional,
} from './comunes';
const MENSAJE_DOCUMENTO_OBLIGATORIO = 'Debes adjuntar el documento legal';

export const esquemaFundacion = z.object({
  nombre: textoObligatorio(
    'El nombre de la fundación es obligatorio',
    120,
    'El nombre no puede superar los 120 caracteres',
  ),
  nit: z
    .string({ error: 'El NIT debe tener entre 5 y 20 caracteres: números, puntos o guion' })
    .trim()
    .regex(
      /^[0-9][0-9.-]{3,18}[0-9]$/,
      'El NIT debe tener entre 5 y 20 caracteres: números, puntos o guion',
    ),
  direccion: textoObligatorio(
    'La dirección es obligatoria',
    150,
    'La dirección no puede superar los 150 caracteres',
  ),
  ciudad: textoObligatorio(
    'La ciudad es obligatoria',
    60,
    'La ciudad no puede superar los 60 caracteres',
  ),
  descripcion: textoOpcional(500, 'La descripción no puede superar los 500 caracteres'),
  telefono,
  email: correo,
  contrasena: contrasenaSegura,
  documento: z
    .custom<File>((v) => typeof File !== 'undefined' && v instanceof File, {
      error: MENSAJE_DOCUMENTO_OBLIGATORIO,
    })
    .superRefine((archivo, ctx) => {
      const resultado = validarDocumento(archivo);
      if (!resultado.ok) ctx.addIssue({ code: 'custom', message: resultado.mensaje });
    }),
  aceptaPoliticaDatos: aceptaPolitica,
});

export type DatosFundacion = z.infer<typeof esquemaFundacion>;
