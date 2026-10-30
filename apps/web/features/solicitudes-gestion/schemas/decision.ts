import { z } from 'zod';
import { esFechaReal } from '@/shared/lib/fechas';

export const MAX_OBSERVACION = 300;

/** Textos del backend (`decision-solicitud.dto.ts`). */
export const MENSAJE_FECHA_OBLIGATORIA = 'Debes indicar la fecha de entrega';
export const MENSAJE_FECHA_REAL =
  'La fecha de entrega debe ser una fecha real con formato AAAA-MM-DD';
export const MENSAJE_FECHA_PASADA = 'La fecha de entrega no puede ser anterior a hoy';
export const MENSAJE_MOTIVO = 'Debes indicar el motivo del rechazo';
export const MENSAJE_OBSERVACION_LARGA = `La observación no puede superar ${MAX_OBSERVACION} caracteres`;

/**
 * Espejo del DTO de decisión. `hoy` es el día de Bogotá (`hoyEnBogota()`), no el del navegador:
 * entregar hoy es válido. Lo que no corresponde a la decisión ni se valida ni se envía.
 */
export function crearEsquemaDecision(hoy: string) {
  const aprobar = z.object({
    decision: z.literal('aprobar'),
    fechaEntrega: z
      .string({ error: MENSAJE_FECHA_OBLIGATORIA })
      .trim()
      .min(1, MENSAJE_FECHA_OBLIGATORIA)
      .superRefine((f, ctx) => {
        if (f === '') return;
        if (!esFechaReal(f)) return ctx.addIssue({ code: 'custom', message: MENSAJE_FECHA_REAL });
        if (f < hoy) ctx.addIssue({ code: 'custom', message: MENSAJE_FECHA_PASADA });
      }),
    // En blanco equivale a no enviarla (como en el backend).
    observacion: z
      .string()
      .trim()
      .max(MAX_OBSERVACION, MENSAJE_OBSERVACION_LARGA)
      .optional()
      .transform((o) => (o ? o : undefined)),
  });
  const rechazar = z.object({
    decision: z.literal('rechazar'),
    observacion: z
      .string({ error: MENSAJE_MOTIVO })
      .trim()
      .min(1, MENSAJE_MOTIVO)
      .max(MAX_OBSERVACION, MENSAJE_OBSERVACION_LARGA),
  });
  return z.discriminatedUnion('decision', [aprobar, rechazar], {
    error: 'Elige si quieres aprobar o rechazar la solicitud',
  });
}

export type DatosDecisionValidados = z.output<ReturnType<typeof crearEsquemaDecision>>;
