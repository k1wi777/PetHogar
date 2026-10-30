/**
 * Prefijos de las claves de TanStack Query de las features. Las features no se
 * importan entre sí: este contrato compartido permite que, por ejemplo, aprobar una solicitud
 * invalide también las listas de adopciones y de mascotas sin acoplar sus hooks.
 */
export const CLAVE_SOLICITUDES_GESTION = 'solicitudes-gestion';
export const CLAVE_ADOPCIONES_GESTION = 'adopciones-gestion';
export const CLAVE_MASCOTAS_GESTION = 'mascotas-gestion';
export const CLAVE_DONACIONES_GESTION = 'donaciones-gestion';
export const CLAVE_ADMIN_FUNDACIONES = 'admin-fundaciones';
export const CLAVE_ADMIN_USUARIOS = 'admin-usuarios';
export const CLAVE_REPORTES = 'reportes';
