import { z } from 'zod';
import { esFechaReal } from '@/shared/lib/fechas';
import { TIPOS_SEGUIMIENTO } from '../types';

export const MENSAJE_TIPO = 'El tipo debe ser visita o reporte';
export const MENSAJE_FECHA_OBLIGATORIA = 'Debes indicar la fecha del seguimiento';
export const MENSAJE_FECHA_REAL =
  'La fecha del seguimiento debe ser una fecha real con formato AAAA-MM-DD';
export const MENSAJE_FECHA_PASADA = 'La fecha del seguimiento no puede ser anterior a hoy';
export const mensajePosteriorAEntrega = (fechaEntrega: string) =>
  `La fecha del seguimiento debe ser posterior a la fecha de entrega (${fechaEntrega})`;

/**
 * Espejo del backend: la fecha debe ser posterior a la entrega y no anterior a hoy (Bogotá).
 * `fechaEntrega` y `hoy` son `AAAA-MM-DD` y se comparan como texto.
 */
export function crearEsquemaProgramar(fechaEntrega: string, hoy: string) {
  return z.object({
    tipo: z.enum(TIPOS_SEGUIMIENTO, { error: MENSAJE_TIPO }),
    fechaProgramada: z
      .string({ error: MENSAJE_FECHA_OBLIGATORIA })
      .trim()
      .min(1, MENSAJE_FECHA_OBLIGATORIA)
      .superRefine((f, ctx) => {
        if (f === '') return;
        if (!esFechaReal(f)) return ctx.addIssue({ code: 'custom', message: MENSAJE_FECHA_REAL });
        if (f <= fechaEntrega) {
          return ctx.addIssue({ code: 'custom', message: mensajePosteriorAEntrega(fechaEntrega) });
        }
        if (f < hoy) ctx.addIssue({ code: 'custom', message: MENSAJE_FECHA_PASADA });
      }),
  });
}

export type DatosProgramarValidados = z.output<ReturnType<typeof crearEsquemaProgramar>>;
