import type { IStorageService } from '../../storage/storage.interface';

/**
 * URL pública de una clave de foto. Devuelve `null` si la clave no es de almacenamiento público
 * (p. ej. las rutas `/uploads/demo/…` del seed demo no son claves reales): nunca se expone una
 * clave interna ni se lanza por un dato heredado.
 */
export function urlPublicaFoto(storage: IStorageService, clave: string): string | null {
  return clave.startsWith('publico/') ? storage.urlPublica(clave) : null;
}
