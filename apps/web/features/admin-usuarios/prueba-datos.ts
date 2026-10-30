import type { PaginaUsuarios, UsuarioAdmin } from './types';

/** Datos de ejemplo para las pruebas (no forman parte de la aplicación). */
export function usuario(p: Partial<UsuarioAdmin> = {}): UsuarioAdmin {
  return {
    id: 2,
    email: 'ana@correo.co',
    telefono: '3001234567',
    rol: 'adoptante',
    activo: true,
    emailVerificado: true,
    fechaCreacion: '2026-10-01T15:00:00.000Z',
    nombre: 'Ana Pérez',
    ...p,
  };
}

export function pagina(data: UsuarioAdmin[], extra: Partial<PaginaUsuarios> = {}): PaginaUsuarios {
  return {
    data,
    total: extra.total ?? data.length,
    page: extra.page ?? 1,
    limit: extra.limit ?? 10,
  };
}
