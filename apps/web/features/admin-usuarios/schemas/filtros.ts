import { z } from 'zod';
import { ROLES } from '../types';

export const MAX_BUSQUEDA = 100;

/** Textos del backend (`consulta-usuarios.dto.ts`). */
export const MENSAJE_NOMBRE_LARGO = `El nombre no puede superar los ${MAX_BUSQUEDA} caracteres`;
export const MENSAJE_CORREO_LARGO = `El correo no puede superar los ${MAX_BUSQUEDA} caracteres`;

/** Filtros de la lista: texto recortado de hasta 100 caracteres y rol opcional. */
export const esquemaFiltrosUsuarios = z.object({
  nombre: z.string().trim().max(MAX_BUSQUEDA, MENSAJE_NOMBRE_LARGO),
  correo: z.string().trim().max(MAX_BUSQUEDA, MENSAJE_CORREO_LARGO),
  rol: z.enum(ROLES).optional(),
});

export type FiltrosUsuarios = z.output<typeof esquemaFiltrosUsuarios>;
