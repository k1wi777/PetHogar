import { z } from 'zod';

export const MAX_OBSERVACION = 300;

/** Textos del backend (`validacion-fundacion.dto.ts`). */
export const MENSAJE_MOTIVO = 'Indica el motivo del rechazo';
export const MENSAJE_OBSERVACION_LARGA = `La observación no puede superar los ${MAX_OBSERVACION} caracteres`;

/**
 * Espejo del DTO de validación: rechazar exige observación; al aprobar es opcional y en blanco
 * equivale a no enviarla.
 */
export const esquemaValidacion = z.discriminatedUnion('decision', [
  z.object({
    decision: z.literal('aprobada'),
    observacion: z
      .string()
      .trim()
      .max(MAX_OBSERVACION, MENSAJE_OBSERVACION_LARGA)
      .optional()
      .transform((o) => (o ? o : undefined)),
  }),
  z.object({
    decision: z.literal('rechazada'),
    observacion: z
      .string({ error: MENSAJE_MOTIVO })
      .trim()
      .min(1, MENSAJE_MOTIVO)
      .max(MAX_OBSERVACION, MENSAJE_OBSERVACION_LARGA),
  }),
]);

export type DatosValidacionValidados = z.output<typeof esquemaValidacion>;
