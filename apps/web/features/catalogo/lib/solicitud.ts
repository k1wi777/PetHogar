/**
 * Destino del formulario de solicitud de adopción. Hoy la acción es provisional (aviso en línea);
 * cuando exista la pantalla de solicitud (F-10) solo cambia esta función.
 */
export function rutaSolicitud(mascotaId: number): string {
  return `/adoptante/solicitudes/nueva?mascota=${mascotaId}`;
}

/** Ficha a la que se regresa tras ingresar. */
export function rutaFicha(mascotaId: number): string {
  return `/mascotas/${mascotaId}`;
}

/** Enlace de ingreso que devuelve a la ficha. */
export function rutaIngresoParaAdoptar(mascotaId: number): string {
  return `/ingresar?siguiente=${encodeURIComponent(rutaFicha(mascotaId))}`;
}
