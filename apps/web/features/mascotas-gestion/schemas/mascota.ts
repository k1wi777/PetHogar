import { z } from 'zod';
import type { CambiosMascota, DatosMascota, MascotaGestion, Sexo, Tamano } from '../types';

/** Límites y textos espejo del backend (`campos-mascota.ts`): un error local y uno del servidor se ven igual. */
export const LIMITES = { nombre: 60, color: 40, estadoSalud: 200, descripcion: 500 } as const;
export const EDAD_MAXIMA_MESES = 360;
export const MENSAJE_EDAD_MAXIMA = `La edad no puede superar ${EDAD_MAXIMA_MESES} meses (30 años)`;
const SEXOS: readonly Sexo[] = ['macho', 'hembra'];
const TAMANOS: readonly Tamano[] = ['pequeño', 'mediano', 'grande'];
const MENSAJE_SEXO = 'El sexo debe ser macho o hembra';
const MENSAJE_TAMANO = 'El tamaño debe ser pequeño, mediano o grande';
export const MENSAJE_EDAD_OBLIGATORIA = 'Indica la edad de la mascota';

/** Años y meses → meses enteros (el backend recibe solo meses). */
export function aMeses(anios: number, meses: number): number {
  return anios * 12 + meses;
}

/** Camino inverso, para mostrar la edad guardada descompuesta al editar. */
export function desdeMeses(total: number): { anios: number; meses: number } {
  const n = Math.max(0, Math.floor(total));
  return { anios: Math.floor(n / 12), meses: n % 12 };
}

export type ProblemaEdad = { campo: 'anios' | 'meses'; mensaje: string };

/** Valida los dos campos de texto de la edad; `null` si son correctos. */
export function problemaDeEdad(anios: string, meses: string): ProblemaEdad | null {
  const a = anios.trim();
  const m = meses.trim();
  if (!a && !m) return { campo: 'anios', mensaje: MENSAJE_EDAD_OBLIGATORIA };
  if (a && !/^\d{1,3}$/.test(a)) {
    return { campo: 'anios', mensaje: 'Los años deben ser un número entero, sin signos' };
  }
  if (m && !/^\d{1,3}$/.test(m)) {
    return { campo: 'meses', mensaje: 'Los meses deben ser un número entero, sin signos' };
  }
  const nMeses = Number(m || 0);
  if (nMeses > 11) return { campo: 'meses', mensaje: 'Los meses deben estar entre 0 y 11' };
  if (aMeses(Number(a || 0), nMeses) > EDAD_MAXIMA_MESES) {
    return { campo: 'anios', mensaje: MENSAJE_EDAD_MAXIMA };
  }
  return null;
}

/** Edad en meses de los campos de texto ya validados. */
export function edadEnMeses(anios: string, meses: string): number {
  return aMeses(Number(anios.trim() || 0), Number(meses.trim() || 0));
}

export const esquemaMascota = z
  .object({
    nombre: z
      .string({ error: 'El nombre es obligatorio' })
      .trim()
      .min(1, 'El nombre es obligatorio')
      .max(LIMITES.nombre, `El nombre no puede superar ${LIMITES.nombre} caracteres`),
    // La especie solo ayuda a filtrar las razas: el backend recibe `razaId`.
    especieId: z.string({ error: 'Elige la especie' }).min(1, 'Elige la especie'),
    razaId: z.string({ error: 'Elige la raza' }).min(1, 'Elige la raza'),
    // Texto (no `z.enum`): un tipo inválido aborta la validación y ocultaría el error de la edad.
    sexo: z.string({ error: MENSAJE_SEXO }).refine((v) => SEXOS.includes(v as Sexo), MENSAJE_SEXO),
    anios: z.string(),
    meses: z.string(),
    tamano: z
      .string({ error: MENSAJE_TAMANO })
      .refine((v) => TAMANOS.includes(v as Tamano), MENSAJE_TAMANO),
    estadoSalud: z
      .string({ error: 'El estado de salud es obligatorio' })
      .trim()
      .min(1, 'El estado de salud es obligatorio')
      .max(
        LIMITES.estadoSalud,
        `El estado de salud no puede superar ${LIMITES.estadoSalud} caracteres`,
      ),
    color: z
      .string()
      .trim()
      .max(LIMITES.color, `El color no puede superar ${LIMITES.color} caracteres`),
    descripcion: z
      .string()
      .trim()
      .max(
        LIMITES.descripcion,
        `La descripción no puede superar ${LIMITES.descripcion} caracteres`,
      ),
    esterilizado: z.boolean(),
    vacunado: z.boolean(),
  })
  .superRefine((valores, ctx) => {
    const problema = problemaDeEdad(valores.anios, valores.meses);
    if (problema)
      ctx.addIssue({ code: 'custom', path: [problema.campo], message: problema.mensaje });
  });

export type ValoresMascota = z.infer<typeof esquemaMascota>;

export const VALORES_INICIALES: Partial<ValoresMascota> = {
  nombre: '',
  especieId: '',
  razaId: '',
  sexo: '',
  tamano: '',
  anios: '',
  meses: '',
  estadoSalud: '',
  color: '',
  descripcion: '',
  esterilizado: false,
  vacunado: false,
};

/** Valores del formulario de una mascota existente (la especie se resuelve aparte). */
export function valoresDesdeMascota(
  mascota: MascotaGestion,
  especieId: number | null,
): ValoresMascota {
  const { anios, meses } = desdeMeses(mascota.edadMeses);
  return {
    nombre: mascota.nombre,
    especieId: especieId === null ? '' : String(especieId),
    razaId: String(mascota.razaId),
    sexo: mascota.sexo,
    anios: String(anios),
    meses: String(meses),
    tamano: mascota.tamano,
    estadoSalud: mascota.estadoSalud,
    color: mascota.color ?? '',
    descripcion: mascota.descripcion ?? '',
    esterilizado: mascota.esterilizado,
    vacunado: mascota.vacunado,
  };
}

/** Cuerpo de `POST /mascotas`; los textos opcionales vacíos se omiten. */
export function aDatosMascota(valores: ValoresMascota): DatosMascota {
  const color = valores.color.trim();
  const descripcion = valores.descripcion.trim();
  return {
    nombre: valores.nombre.trim(),
    razaId: Number(valores.razaId),
    sexo: valores.sexo as Sexo,
    edadMeses: edadEnMeses(valores.anios, valores.meses),
    tamano: valores.tamano as Tamano,
    estadoSalud: valores.estadoSalud.trim(),
    ...(color ? { color } : {}),
    ...(descripcion ? { descripcion } : {}),
    esterilizado: valores.esterilizado,
    vacunado: valores.vacunado,
  };
}

/** Cuerpo del `PATCH`: solo lo que cambió respecto de la mascota original (un texto vaciado se envía como `null`). */
export function cambiosMascota(valores: ValoresMascota, original: MascotaGestion): CambiosMascota {
  const nuevo = aDatosMascota(valores);
  const cambios: CambiosMascota = {};
  if (nuevo.nombre !== original.nombre) cambios.nombre = nuevo.nombre;
  if (nuevo.razaId !== original.razaId) cambios.razaId = nuevo.razaId;
  if (nuevo.sexo !== original.sexo) cambios.sexo = nuevo.sexo;
  if (nuevo.edadMeses !== original.edadMeses) cambios.edadMeses = nuevo.edadMeses;
  if (nuevo.tamano !== original.tamano) cambios.tamano = nuevo.tamano;
  if (nuevo.estadoSalud !== original.estadoSalud) cambios.estadoSalud = nuevo.estadoSalud;
  if ((nuevo.color ?? null) !== original.color) cambios.color = nuevo.color ?? null;
  if ((nuevo.descripcion ?? null) !== original.descripcion) {
    cambios.descripcion = nuevo.descripcion ?? null;
  }
  if (nuevo.esterilizado !== original.esterilizado) cambios.esterilizado = nuevo.esterilizado;
  if (nuevo.vacunado !== original.vacunado) cambios.vacunado = nuevo.vacunado;
  return cambios;
}
