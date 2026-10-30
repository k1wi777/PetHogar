import { z } from 'zod';
import { esFechaReal } from '@/shared/lib/fechas';

/** Textos del backend (`consulta-donaciones.dto.ts` y `donaciones.constants.ts`). */
export const MENSAJE_DESDE = 'La fecha inicial debe ser una fecha real con formato AAAA-MM-DD';
export const MENSAJE_HASTA = 'La fecha final debe ser una fecha real con formato AAAA-MM-DD';
export const MENSAJE_PERIODO_INVERTIDO = 'La fecha final no puede ser anterior a la inicial';

const fecha = (mensaje: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || esFechaReal(v), mensaje);

/** Periodo del filtro: cada fecha, si existe, debe ser real y `hasta` no puede ser anterior a `desde`. */
export const esquemaPeriodo = z
  .object({ desde: fecha(MENSAJE_DESDE), hasta: fecha(MENSAJE_HASTA) })
  .superRefine((p, ctx) => {
    if (p.desde && p.hasta && esFechaReal(p.desde) && esFechaReal(p.hasta) && p.hasta < p.desde) {
      ctx.addIssue({ code: 'custom', path: ['hasta'], message: MENSAJE_PERIODO_INVERTIDO });
    }
  });

export type DatosPeriodo = z.output<typeof esquemaPeriodo>;
