import { z } from 'zod';
import { validarDocumento } from '@/shared/lib/archivo';
import {
  MENSAJE_MONTO_OBLIGATORIO,
  mensajeDeProblema,
  normalizarMonto,
  problemaDeMonto,
} from '@/shared/lib/monto';

export const MIN_NOMBRE = 2;
export const MAX_NOMBRE = 100;
export const MAX_DESCRIPCION = 300;
export const MENSAJE_NOMBRE = `El nombre del donante debe tener entre ${MIN_NOMBRE} y ${MAX_NOMBRE} caracteres`;
export const MENSAJE_DESCRIPCION = 'Describe lo que donas (entre 1 y 300 caracteres)';

const nombreDonante = z
  .string({ error: MENSAJE_NOMBRE })
  .trim()
  .min(MIN_NOMBRE, MENSAJE_NOMBRE)
  .max(MAX_NOMBRE, MENSAJE_NOMBRE);

const comprobante = z
  .custom<File>((v) => typeof File !== 'undefined' && v instanceof File)
  .superRefine((archivo, ctx) => {
    const r = validarDocumento(archivo);
    if (!r.ok) ctx.addIssue({ code: 'custom', message: r.mensaje });
  })
  .optional();

const economica = z.object({
  tipo: z.literal('economica'),
  nombreDonante,
  // Cadena: se valida con BigInt y se envía tal cual (coma normalizada a punto), sin convertir a número.
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
  nombreDonante,
  descripcion: z
    .string({ error: MENSAJE_DESCRIPCION })
    .trim()
    .min(1, MENSAJE_DESCRIPCION)
    .max(MAX_DESCRIPCION, MENSAJE_DESCRIPCION),
  comprobante,
});

/** Unión discriminada por `tipo`: el campo que no corresponde ni se valida ni se envía. */
export const esquemaDonacionManual = z.discriminatedUnion('tipo', [economica, especie], {
  error: 'Elige el tipo de aporte',
});

export type DatosDonacionManualValidados = z.output<typeof esquemaDonacionManual>;
