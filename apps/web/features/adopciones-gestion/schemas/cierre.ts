import { z } from 'zod';
import { DESTINOS_MASCOTA } from '../types';

export const MAX_MOTIVO_CIERRE = 300;

/** Textos del backend (`cierre-adopcion.dto.ts`). */
export const MENSAJE_ESTADO_CIERRE = 'Elige si quieres finalizar o revocar la adopción';
export const MENSAJE_MOTIVO_CIERRE = 'Debes indicar el motivo';
export const MENSAJE_MOTIVO_LARGO = `El motivo no puede superar ${MAX_MOTIVO_CIERRE} caracteres`;
export const MENSAJE_DESTINO = 'Indica si la mascota vuelve a estar disponible o queda inactiva';

const motivo = z
  .string({ error: MENSAJE_MOTIVO_CIERRE })
  .trim()
  .min(1, MENSAJE_MOTIVO_CIERRE)
  .max(MAX_MOTIVO_CIERRE, MENSAJE_MOTIVO_LARGO);

/**
 * Espejo del DTO de cierre: el motivo es obligatorio y el destino de la mascota solo se pide (y se
 * envía) al revocar. Un cierre nunca tiene un estado por defecto.
 */
export const esquemaCierre = z.discriminatedUnion(
  'estado',
  [
    z.object({ estado: z.literal('finalizada'), motivo }),
    z.object({
      estado: z.literal('revocada'),
      motivo,
      mascotaDestino: z.enum(DESTINOS_MASCOTA, { error: MENSAJE_DESTINO }),
    }),
  ],
  { error: MENSAJE_ESTADO_CIERRE },
);

export type DatosCierreValidados = z.output<typeof esquemaCierre>;
