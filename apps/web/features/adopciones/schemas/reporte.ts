import { z } from 'zod';
import { SOLO_IMAGENES, validarDocumento } from '@/shared/lib/archivo';

export const MAX_COMENTARIOS = 500;
export const MAX_FOTOS_REPORTE = 5;

/** Textos del backend: un error local y uno del servidor se ven igual. */
export const esquemaReporte = z.object({
  comentarios: z
    .string({ error: 'Cuéntanos cómo está la mascota' })
    .trim()
    .min(1, 'Cuéntanos cómo está la mascota')
    .max(MAX_COMENTARIOS, `Los comentarios no pueden superar ${MAX_COMENTARIOS} caracteres`),
  fotos: z
    .array(z.custom<File>((v) => typeof File !== 'undefined' && v instanceof File))
    .max(MAX_FOTOS_REPORTE, `Puedes adjuntar hasta ${MAX_FOTOS_REPORTE} fotos`)
    .superRefine((fotos, ctx) => {
      for (const f of fotos) {
        const r = validarDocumento(f, SOLO_IMAGENES);
        if (!r.ok) ctx.addIssue({ code: 'custom', message: `${f.name}: ${r.mensaje}` });
      }
    })
    .optional(),
});

export type DatosReporte = z.infer<typeof esquemaReporte>;
