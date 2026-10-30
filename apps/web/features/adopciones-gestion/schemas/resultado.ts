import { z } from 'zod';
import { SOLO_IMAGENES, validarDocumento } from '@/shared/lib/archivo';
import { esFechaReal } from '@/shared/lib/fechas';
import { ESTADOS_BIENESTAR } from '../types';

export const MAX_OBSERVACIONES = 500;
export const MAX_EVIDENCIAS = 5;

export const MENSAJE_FECHA_OBLIGATORIA = 'Debes indicar la fecha en que se realizó el seguimiento';
export const MENSAJE_FECHA_REAL =
  'La fecha realizada debe ser una fecha real con formato AAAA-MM-DD';
export const MENSAJE_FECHA_FUTURA = 'La fecha realizada no puede ser futura';
export const MENSAJE_BIENESTAR = 'El estado de bienestar debe ser bueno, regular o malo';
export const MENSAJE_OBSERVACIONES = 'Las observaciones son obligatorias';
export const mensajeAnteriorAEntrega = (fechaEntrega: string) =>
  `La fecha realizada no puede ser anterior a la fecha de entrega (${fechaEntrega})`;

/**
 * Espejo del backend: fecha realizada entre la entrega y hoy (Bogotá), bienestar, observaciones de
 * 1 a 500 caracteres y hasta 5 evidencias JPG/PNG de 5 MB. El backend sigue siendo la autoridad.
 */
export function crearEsquemaResultado(fechaEntrega: string, hoy: string) {
  return z.object({
    fechaRealizada: z
      .string({ error: MENSAJE_FECHA_OBLIGATORIA })
      .trim()
      .min(1, MENSAJE_FECHA_OBLIGATORIA)
      .superRefine((f, ctx) => {
        if (f === '') return;
        if (!esFechaReal(f)) return ctx.addIssue({ code: 'custom', message: MENSAJE_FECHA_REAL });
        if (f > hoy) return ctx.addIssue({ code: 'custom', message: MENSAJE_FECHA_FUTURA });
        if (f < fechaEntrega) {
          ctx.addIssue({ code: 'custom', message: mensajeAnteriorAEntrega(fechaEntrega) });
        }
      }),
    estadoBienestar: z.enum(ESTADOS_BIENESTAR, { error: MENSAJE_BIENESTAR }),
    observaciones: z
      .string({ error: MENSAJE_OBSERVACIONES })
      .trim()
      .min(1, MENSAJE_OBSERVACIONES)
      .max(
        MAX_OBSERVACIONES,
        `Las observaciones no pueden superar ${MAX_OBSERVACIONES} caracteres`,
      ),
    evidencias: z
      .array(z.custom<File>((v) => typeof File !== 'undefined' && v instanceof File))
      .max(MAX_EVIDENCIAS, `Puedes adjuntar hasta ${MAX_EVIDENCIAS} fotos`)
      .superRefine((fotos, ctx) => {
        for (const f of fotos) {
          const r = validarDocumento(f, SOLO_IMAGENES);
          if (!r.ok) ctx.addIssue({ code: 'custom', message: `${f.name}: ${r.mensaje}` });
        }
      })
      .optional(),
  });
}

export type DatosResultadoValidados = z.output<ReturnType<typeof crearEsquemaResultado>>;
