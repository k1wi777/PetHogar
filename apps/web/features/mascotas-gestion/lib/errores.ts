import { esErrorApi } from '@/shared/api/errores';

/** Campos del formulario de datos; `edadMeses` del servidor se muestra en el campo de años. */
export const CAMPOS_MASCOTA = [
  'nombre',
  'razaId',
  'sexo',
  'edadMeses',
  'tamano',
  'estadoSalud',
  'color',
  'descripcion',
  'esterilizado',
  'vacunado',
] as const;

export const CAMPOS_HISTORIAL = ['tipo', 'fecha', 'descripcion', 'veterinario'] as const;

/** Campo del formulario (nombre del esquema) que corresponde a un campo del servidor. */
export function campoDeFormulario(campoServidor: string): string {
  return campoServidor === 'edadMeses' ? 'anios' : campoServidor;
}

/** La fundación dejó de estar aprobada (el backend responde 403 en toda ruta operativa). */
export function esFundacionNoAprobada(error: unknown): boolean {
  return esErrorApi(error) && error.estado === 403;
}

/** 409: el estado de la mascota cambió en el servidor. */
export function esConflicto(error: unknown): boolean {
  return esErrorApi(error) && error.estado === 409;
}

export function esNoEncontrada(error: unknown): boolean {
  return esErrorApi(error) && error.estado === 404;
}
