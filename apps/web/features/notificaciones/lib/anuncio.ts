/**
 * Texto para la región `aria-live` cuando el contador AUMENTA respecto de un valor ya conocido.
 * Devuelve `null` en la primera carga (sin valor previo), cuando queda igual o cuando baja.
 */
export function textoAnuncio(
  anterior: number | undefined,
  actual: number | undefined,
): string | null {
  if (anterior === undefined || actual === undefined || actual <= anterior) return null;
  const nuevas = actual - anterior;
  return nuevas === 1
    ? 'Tienes una notificación nueva.'
    : `Tienes ${nuevas} notificaciones nuevas.`;
}
