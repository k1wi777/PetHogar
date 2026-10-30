import { esErrorApi } from '@/shared/api/errores';

/** Campo del formulario de decisión al que pertenece un 4xx sin campo, según el texto del servidor. */
export function campoDelMensaje(mensaje: string): string | null {
  const texto = mensaje.toLowerCase();
  if (texto.includes('fecha de entrega')) return 'fechaEntrega';
  if (texto.includes('observación') || texto.includes('motivo')) return 'observacion';
  return null;
}

export function esConflicto(error: unknown): boolean {
  return esErrorApi(error) && error.estado === 409;
}

export function esNoEncontrada(error: unknown): boolean {
  return esErrorApi(error) && (error.estado === 404 || error.estado === 400);
}

/** La fundación dejó de estar aprobada (el backend responde 403 en toda ruta operativa). */
export function esFundacionNoAprobada(error: unknown): boolean {
  return esErrorApi(error) && error.estado === 403;
}
