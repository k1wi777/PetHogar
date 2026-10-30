export const ROLES = ['adoptante', 'fundacion', 'administrador'] as const;
export type RolUsuario = (typeof ROLES)[number];

export const ETIQUETA_ROL: Readonly<Record<RolUsuario, string>> = {
  adoptante: 'Adoptante',
  fundacion: 'Fundación',
  administrador: 'Administrador',
};

/** Fila de `GET /admin/usuarios`; `nombre` es null en los administradores. */
export interface UsuarioAdmin {
  id: number;
  email: string;
  telefono: string;
  rol: RolUsuario;
  activo: boolean;
  emailVerificado: boolean;
  fechaCreacion: string;
  nombre: string | null;
}

export interface PaginaUsuarios {
  data: UsuarioAdmin[];
  total: number;
  page: number;
  limit: number;
}

export interface ConsultaUsuarios {
  pagina: number;
  nombre?: string;
  correo?: string;
  rol?: RolUsuario;
}
