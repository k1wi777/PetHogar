import { z } from 'zod';

/** Los textos son idénticos a los del DTO del backend: un error local y uno del servidor se ven igual. */

export const MENSAJE_TELEFONO = 'El teléfono debe tener entre 7 y 14 dígitos (puede iniciar con +)';
export const MENSAJE_POLITICA = 'Debes aceptar la política de tratamiento de datos personales';

/** Texto obligatorio, recortado y con tope. */
export const textoObligatorio = (obligatorio: string, tope: number, topeMensaje: string) =>
  z.string({ error: obligatorio }).trim().min(1, obligatorio).max(tope, topeMensaje);

/** Texto opcional con tope (puede quedar vacío). */
export const textoOpcional = (tope: number, topeMensaje: string) =>
  z.string().trim().max(tope, topeMensaje).optional();

/** Correo recortado y en minúsculas, como lo normaliza el backend. */
export const correo = z
  .string({ error: 'Ingresa un correo electrónico válido' })
  .trim()
  .toLowerCase()
  .max(100, 'El correo no puede superar los 100 caracteres')
  .pipe(z.email('Ingresa un correo electrónico válido'));

export const telefono = z
  .string({ error: MENSAJE_TELEFONO })
  .trim()
  .regex(/^\+?\d{7,14}$/, MENSAJE_TELEFONO);

/** Política: 8 a 64 caracteres con mayúscula, minúscula y número. */
export const contrasenaSegura = z
  .string({ error: 'La contraseña debe ser un texto' })
  .min(8, 'La contraseña debe tener entre 8 y 64 caracteres')
  .max(64, 'La contraseña debe tener entre 8 y 64 caracteres')
  .regex(/[A-Z]/, 'La contraseña debe incluir al menos una letra mayúscula')
  .regex(/[a-z]/, 'La contraseña debe incluir al menos una letra minúscula')
  .regex(/\d/, 'La contraseña debe incluir al menos un número');

export const aceptaPolitica = z.boolean().refine((v) => v === true, MENSAJE_POLITICA);
