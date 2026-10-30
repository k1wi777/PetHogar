import { esErrorApi } from '@/shared/api/errores';

/** Campos del formulario de «Programar seguimiento» y del de resultado, según el texto del servidor. */
export function campoDelMensaje(mensaje: string): string | null {
  const t = mensaje.toLowerCase();
  if (t.includes('foto') || t.includes('archivo') || t.includes('evidencia')) return 'evidencias';
  if (t.includes('fecha realizada')) return 'fechaRealizada';
  if (t.includes('fecha del seguimiento')) return 'fechaProgramada';
  return null;
}

export function esNoEncontrada(error: unknown): boolean {
  return esErrorApi(error) && (error.estado === 404 || error.estado === 400);
}

export function esFundacionNoAprobada(error: unknown): boolean {
  return esErrorApi(error) && error.estado === 403;
}
