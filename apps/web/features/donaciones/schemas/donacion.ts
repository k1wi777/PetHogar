import { z } from 'zod';
import { validarDocumento } from '@/shared/lib/archivo';
import {
  MENSAJE_MONTO_OBLIGATORIO,
  mensajeDeProblema,
  normalizarMonto,
  problemaDeMonto,
} from '@/shared/lib/monto';

export const MAX_DESCRIPCION = 300;
export const MENSAJE_DESCRIPCION = 'Describe lo que donas (entre 1 y 300 caracteres)';

const comprobante = z
  .custom<File>((v) => typeof File !== 'undefined' && v instanceof File)
  .superRefine((archivo, ctx) => {
    const r = validarDocumento(archivo);
    if (!r.ok) ctx.addIssue({ code: 'custom', message: r.mensaje });
  })
  .optional();

const economica = z.object({
  tipo: z.literal('economica'),
  // Cadena: se valida y se envía tal cual (con coma normalizada a punto), sin convertir a número.
  monto: z
    .string({ error: MENSAJE_MONTO_OBLIGATORIO })
    .transform(normalizarMonto)
    .superRefine((m, ctx) => {
      if (m === '') return ctx.addIssue({ code: 'custom', message: MENSAJE_MONTO_OBLIGATORIO });
      const problema = problemaDeMonto(m);
      if (problema) ctx.addIssue({ code: 'custom', message: mensajeDeProblema(problema) });
    }),
  comprobante,
});

const especie = z.object({
  tipo: z.literal('especie'),
  descripcion: z
    .string({ error: MENSAJE_DESCRIPCION })
    .trim()
    .min(1, MENSAJE_DESCRIPCION)
    .max(MAX_DESCRIPCION, MENSAJE_DESCRIPCION),
  comprobante,
});

/** Unión discriminada por `tipo`: el campo que no corresponde ni se valida ni se envía. */
export const esquemaDonacion = z.discriminatedUnion('tipo', [economica, especie], {
  error: 'Elige el tipo de donación',
});

export type DatosDonacion = z.output<typeof esquemaDonacion>;
export type EntradaDonacion = z.input<typeof esquemaDonacion>;
