export type Rol = 'adoptante' | 'fundacion' | 'administrador';
export type EstadoValidacion = 'pendiente' | 'aprobada' | 'rechazada';

export interface PerfilAdoptante {
  primerNombre: string;
  segundoNombre: string | null;
  primerApellido: string;
  segundoApellido: string | null;
}

export interface PerfilFundacion {
  id: number;
  nombre: string;
  estadoValidacion: EstadoValidacion;
  observacionValidacion: string | null;
}

/** Respuesta de `GET /auth/me` y campo `usuario` de login/refresh. */
export interface Usuario {
  id: number;
  email: string;
  telefono: string;
  rol: Rol;
  adoptante: PerfilAdoptante | null;
  fundacion: PerfilFundacion | null;
}

/** Cuerpo de `POST /auth/login` y `POST /auth/refresh`. */
export interface RespuestaSesion {
  accessToken: string;
  expiresIn: number;
  usuario: Usuario;
}

/** Respuesta paginada de la API. */
export interface Pagina<T> {
  total: number;
  page: number;
  limit: number;
  data: T[];
}

export function nombreVisible(usuario: Usuario): string {
  if (usuario.fundacion) return usuario.fundacion.nombre;
  if (usuario.adoptante)
    return `${usuario.adoptante.primerNombre} ${usuario.adoptante.primerApellido}`;
  return 'Administrador';
}
