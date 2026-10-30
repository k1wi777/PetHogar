import { CLAVE_NOTIFICACIONES } from '@/shared/lib/claves-consulta';
import type { ConsultaNotificaciones } from '../types';

/** Claves de TanStack Query de la feature; todas cuelgan del prefijo compartido. */
export const claves = {
  todas: [CLAVE_NOTIFICACIONES] as const,
  noLeidas: [CLAVE_NOTIFICACIONES, 'no-leidas'] as const,
  lista: (c?: ConsultaNotificaciones) =>
    (c
      ? [CLAVE_NOTIFICACIONES, 'lista', c]
      : [CLAVE_NOTIFICACIONES, 'lista']) as readonly unknown[],
  recientes: [CLAVE_NOTIFICACIONES, 'recientes'] as const,
};
