import type { Request } from 'express';

export const ROLES_NOMBRES = ['adoptante', 'fundacion', 'administrador'] as const;

export type RolNombre = (typeof ROLES_NOMBRES)[number];

/** Lo único que el access token aporta a la petición: quién es y con qué rol. */
export interface UsuarioAutenticado {
  id: number;
  rol: RolNombre;
}

export type SolicitudAutenticada = Request & { user?: UsuarioAutenticado };
