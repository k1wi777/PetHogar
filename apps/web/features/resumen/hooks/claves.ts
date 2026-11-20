import {
  CLAVE_ADMIN_FUNDACIONES,
  CLAVE_DONACIONES_GESTION,
  CLAVE_MASCOTAS_GESTION,
  CLAVE_NOTIFICACIONES,
  CLAVE_REPORTES,
  CLAVE_SOLICITUDES_GESTION,
} from '@/shared/lib/claves-consulta';

/**
 * Las consultas de la fundación y del administrador cuelgan de los prefijos compartidos, así las
 * mutaciones que ya los invalidan (decidir una solicitud, registrar un aporte, validar una
 * fundación…) refrescan el resumen sin acoplar features. Las del adoptante usan prefijos propios
 * del resumen: se renuevan por `staleTime`.
 */
export const claves = {
  adoptante: {
    solicitudes: ['resumen', 'adoptante', 'solicitudes'] as const,
    adopciones: ['resumen', 'adoptante', 'adopciones'] as const,
    seguimientos: ['resumen', 'adoptante', 'seguimientos'] as const,
  },
  fundacion: {
    mascotas: [CLAVE_MASCOTAS_GESTION, 'resumen', 'conteo'] as const,
    solicitudes: [CLAVE_SOLICITUDES_GESTION, 'resumen', 'pendientes'] as const,
    seguimientos: ['resumen', 'fundacion', 'seguimientos'] as const,
    donaciones: (desde: string, hasta: string) =>
      [CLAVE_DONACIONES_GESTION, 'resumen', desde, hasta] as const,
  },
  administrador: {
    fundaciones: [CLAVE_ADMIN_FUNDACIONES, 'resumen', 'por-validar'] as const,
    estadisticas: [CLAVE_REPORTES, 'resumen', 'extracto'] as const,
  },
  /** No reutiliza la clave de la campana: su forma y su sondeo son de otra feature. */
  noLeidas: [CLAVE_NOTIFICACIONES, 'resumen-no-leidas'] as const,
};
