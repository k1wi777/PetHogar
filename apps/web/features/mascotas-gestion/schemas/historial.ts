import { z } from 'zod';
import type { DatosHistorial, TipoHistorial } from '../types';

/** Textos y límites espejo del backend (`crear-historial.dto.ts` e `historial.service.ts`). */
export const MAX_DESCRIPCION = 300;
export const MAX_VETERINARIO = 100;
export const MENSAJE_FECHA_REAL = 'La fecha debe ser una fecha real con formato AAAA-MM-DD';
export const MENSAJE_FECHA_FUTURA = 'La fecha del registro no puede ser futura';

const MENSAJE_TIPO = 'El tipo debe ser vacuna, desparasitación, cirugía o consulta';
export const TIPOS_HISTORIAL = ['vacuna', 'desparasitacion', 'cirugia', 'consulta'] as const;

/** Hoy como `AAAA-MM-DD` en America/Bogota, la zona con la que el backend decide si una fecha es futura. */
export function hoyBogota(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

/** `AAAA-MM-DD` que exista en el calendario (rechaza 2026-02-30). */
export function esFechaReal(texto: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return false;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
  );
}

export const esquemaHistorial = z.object({
  // Texto (no `z.enum`): un tipo inválido aborta la validación y ocultaría los errores de los demás campos.
  tipo: z
    .string({ error: MENSAJE_TIPO })
    .refine((v) => TIPOS_HISTORIAL.includes(v as TipoHistorial), MENSAJE_TIPO),
  fecha: z
    .string({ error: MENSAJE_FECHA_REAL })
    .trim()
    .superRefine((fecha, ctx) => {
      if (!esFechaReal(fecha)) {
        ctx.addIssue({ code: 'custom', message: MENSAJE_FECHA_REAL });
      } else if (fecha > hoyBogota()) {
        ctx.addIssue({ code: 'custom', message: MENSAJE_FECHA_FUTURA });
      }
    }),
  descripcion: z
    .string({ error: 'La descripción es obligatoria' })
    .trim()
    .min(1, 'La descripción es obligatoria')
    .max(MAX_DESCRIPCION, `La descripción no puede superar ${MAX_DESCRIPCION} caracteres`),
  veterinario: z
    .string()
    .trim()
    .max(MAX_VETERINARIO, `El veterinario no puede superar ${MAX_VETERINARIO} caracteres`),
});

export type ValoresHistorial = z.infer<typeof esquemaHistorial>;

export function aDatosHistorial(valores: ValoresHistorial): DatosHistorial {
  const veterinario = valores.veterinario.trim();
  return {
    tipo: valores.tipo as TipoHistorial,
    fecha: valores.fecha.trim(),
    descripcion: valores.descripcion.trim(),
    ...(veterinario ? { veterinario } : {}),
  };
}
