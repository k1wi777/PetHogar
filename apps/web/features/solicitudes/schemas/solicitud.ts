import { z } from 'zod';
import { validarDocumento } from '@/shared/lib/archivo';
import { TIPOS_VIVIENDA } from '../types';

/** Los textos son los del backend: un error local y uno del servidor se ven igual. */
export const MAX_MOTIVO = 500;
export const MENSAJE_FORMULARIO_OBLIGATORIO = 'Debes adjuntar el formulario firmado';

export const esquemaSolicitud = z.object({
  motivo: z
    .string({ error: 'El motivo es obligatorio' })
    .trim()
    .min(1, 'El motivo es obligatorio')
    .max(MAX_MOTIVO, `El motivo no puede superar ${MAX_MOTIVO} caracteres`),
  tipoVivienda: z.enum(TIPOS_VIVIENDA, {
    error: 'El tipo de vivienda debe ser casa, apartamento o finca',
  }),
  // Se elige explícitamente (sin valor por defecto): no se envía una respuesta no dada.
  tieneOtrasMascotas: z.boolean({ error: 'Indica si tienes otras mascotas' }),
  formulario: z
    .custom<File>((v) => typeof File !== 'undefined' && v instanceof File, {
      error: MENSAJE_FORMULARIO_OBLIGATORIO,
    })
    .superRefine((archivo, ctx) => {
      const resultado = validarDocumento(archivo);
      if (!resultado.ok) ctx.addIssue({ code: 'custom', message: resultado.mensaje });
    }),
});

export type DatosSolicitud = z.infer<typeof esquemaSolicitud>;
