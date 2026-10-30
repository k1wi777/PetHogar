import type { EstadoMascota } from '../types';

/**
 * Qué puede hacer la fundación con una mascota según su estado. Espejo de `EstadoMascotaMaquina`
 * del backend para el origen «fundación»: allí se decide de verdad, aquí solo se evita ofrecer
 * acciones que terminarían en 409.
 */
export function puedeEditar(estado: EstadoMascota): boolean {
  return estado === 'disponible' || estado === 'en_proceso';
}

export function puedeDarDeBaja(estado: EstadoMascota): boolean {
  return estado === 'disponible';
}

const EXPLICACION_EDICION: Readonly<Record<EstadoMascota, string | null>> = {
  disponible: null,
  en_proceso: null,
  adoptada: 'Ya fue adoptada; sus datos no se pueden modificar.',
  inactiva: 'Fue dada de baja y no puede reactivarse; sus datos no se pueden modificar.',
};

/** Razón por la que los datos están en solo lectura, o `null` si se pueden editar. */
export function explicacionSoloLectura(estado: EstadoMascota): string | null {
  return EXPLICACION_EDICION[estado];
}

const EXPLICACION_BAJA: Readonly<Record<EstadoMascota, string | null>> = {
  disponible: null,
  en_proceso:
    'Tiene una solicitud en curso; podrás darla de baja cuando vuelva a estar disponible.',
  adoptada: 'Ya fue adoptada; el cambio de estado lo gestiona el proceso de adopción.',
  inactiva: 'Ya fue dada de baja y no puede reactivarse.',
};

/** Por qué no se ofrece «Dar de baja», o `null` si se ofrece. */
export function explicacionSinBaja(estado: EstadoMascota): string | null {
  return EXPLICACION_BAJA[estado];
}
