import type { DatosCierre } from '../types';

/**
 * Consecuencias del cierre elegido, en español claro, para el diálogo de confirmación. Al
 * finalizar la mascota sigue adoptada; solo al revocar cambia (disponible o inactiva).
 */
export function consecuenciasDelCierre(datos: DatosCierre, mascota: string): string[] {
  const lista = ['Los seguimientos pendientes se cancelarán.'];
  if (datos.estado === 'finalizada') {
    lista.push(`${mascota} seguirá marcada como adoptada.`);
  } else if (datos.mascotaDestino === 'disponible') {
    lista.push(`${mascota} volverá a estar disponible para que otra persona la adopte.`);
  } else {
    lista.push(`${mascota} quedará inactiva y no se publicará para adopción.`);
  }
  lista.push('Se avisará al adoptante del cierre.', 'Esta decisión no se puede deshacer.');
  return lista;
}

export const AVISO_SIN_ACTA =
  'Todavía no hay acta firmada. Sube el acta antes de cerrar: después no podrás subirla.';

export function anuncioDeCierre(datos: DatosCierre, mascota: string): string {
  return datos.estado === 'finalizada'
    ? `Adopción de ${mascota} finalizada.`
    : `Adopción de ${mascota} revocada.`;
}
