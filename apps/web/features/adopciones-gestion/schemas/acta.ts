import { z } from 'zod';
import { validarDocumento } from '@/shared/lib/archivo';

export const MENSAJE_ACTA_OBLIGATORIA = 'Elige el archivo del acta firmada';

/** Tipo y tamaño se revisan antes de enviar; el backend sigue siendo la autoridad sobre el contenido. */
export const esquemaActa = z.object({
  acta: z
    .custom<File>((v) => typeof File !== 'undefined' && v instanceof File, {
      message: MENSAJE_ACTA_OBLIGATORIA,
    })
    .superRefine((archivo, ctx) => {
      const r = validarDocumento(archivo);
      if (!r.ok) ctx.addIssue({ code: 'custom', message: r.mensaje });
    }),
});

export type DatosActaValidados = z.output<typeof esquemaActa>;
