import { z } from 'zod';
import {
  aceptaPolitica,
  contrasenaSegura,
  correo,
  telefono,
  textoObligatorio,
  textoOpcional,
} from './comunes';

export const EDAD_MINIMA = 18;

/** Misma regla que `mayoria-edad.ts` del backend: fecha civil en UTC, sin husos horarios. */
export function esMayorDeEdad(fechaNacimiento: string, ahora: Date): boolean {
  const [anio, mes, dia] = fechaNacimiento.split('-').map(Number);
  let edad = ahora.getUTCFullYear() - anio;
  const todaviaNoCumple =
    ahora.getUTCMonth() + 1 < mes || (ahora.getUTCMonth() + 1 === mes && ahora.getUTCDate() < dia);
  if (todaviaNoCumple) edad -= 1;
  return edad >= EDAD_MINIMA;
}

/** `AAAA-MM-DD` que existe en el calendario (rechaza 2001-02-30). */
export function esFechaValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
  );
}

/** Fecha máxima (hoy menos 18 años) para el atributo `max` del campo; solo ayuda visual. */
export function fechaMaximaNacimiento(ahora: Date): string {
  const limite = new Date(
    Date.UTC(ahora.getUTCFullYear() - EDAD_MINIMA, ahora.getUTCMonth(), ahora.getUTCDate()),
  );
  return limite.toISOString().slice(0, 10);
}

export const TIPOS_DOCUMENTO = ['CC', 'CE', 'PA'] as const;

export const MENSAJE_MENOR_DE_EDAD = 'Debes ser mayor de 18 años para registrarte';

export const esquemaAdoptante = z.object({
  primerNombre: textoObligatorio(
    'El primer nombre es obligatorio',
    40,
    'El primer nombre no puede superar los 40 caracteres',
  ),
  segundoNombre: textoOpcional(40, 'El segundo nombre no puede superar los 40 caracteres'),
  primerApellido: textoObligatorio(
    'El primer apellido es obligatorio',
    40,
    'El primer apellido no puede superar los 40 caracteres',
  ),
  segundoApellido: textoOpcional(40, 'El segundo apellido no puede superar los 40 caracteres'),
  tipoDocumento: z.enum(TIPOS_DOCUMENTO, { error: 'El tipo de documento debe ser CC, CE o PA' }),
  numeroDocumento: z
    .string({ error: 'El número de documento es obligatorio' })
    .trim()
    .regex(
      /^[A-Za-z0-9]{4,20}$/,
      'El número de documento debe tener entre 4 y 20 letras o números, sin espacios',
    ),
  fechaNacimiento: z
    .string({ error: 'La fecha de nacimiento debe tener el formato AAAA-MM-DD' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha de nacimiento debe tener el formato AAAA-MM-DD')
    .refine(esFechaValida, 'La fecha de nacimiento no es válida')
    .refine((v) => !esFechaValida(v) || esMayorDeEdad(v, new Date()), MENSAJE_MENOR_DE_EDAD),
  telefono,
  email: correo,
  direccion: textoObligatorio(
    'La dirección es obligatoria',
    150,
    'La dirección no puede superar los 150 caracteres',
  ),
  ciudad: textoObligatorio(
    'La ciudad es obligatoria',
    60,
    'La ciudad no puede superar los 60 caracteres',
  ),
  contrasena: contrasenaSegura,
  aceptaPoliticaDatos: aceptaPolitica,
});

export type DatosAdoptante = z.infer<typeof esquemaAdoptante>;
