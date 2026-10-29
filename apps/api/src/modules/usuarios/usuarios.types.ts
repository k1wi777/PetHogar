import type { RolNombre } from '../../common/auth/usuario-autenticado';

/** Usuario tal como lo necesita el login; interno de la API, nunca se serializa tal cual. */
export interface UsuarioCredenciales {
  id: number;
  email: string;
  contrasenaHash: string;
  rol: RolNombre;
  activo: boolean;
  emailVerificado: boolean;
  intentosFallidos: number;
  bloqueadoHasta: Date | null;
  tokenVerificacionExpira: Date | null;
}

export interface PerfilAdoptante {
  primerNombre: string;
  segundoNombre: string | null;
  primerApellido: string;
  segundoApellido: string | null;
}

export interface PerfilUsuario {
  id: number;
  email: string;
  telefono: string;
  rol: RolNombre;
  adoptante: PerfilAdoptante | null;
}

interface DatosCuenta {
  email: string;
  contrasenaHash: string;
  telefono: string;
  aceptaPoliticaDatos: boolean;
  fechaAceptacion: Date;
}

export interface DatosNuevoAdoptante extends DatosCuenta {
  primerNombre: string;
  segundoNombre: string | null;
  primerApellido: string;
  segundoApellido: string | null;
  tipoDocumento: string;
  numeroDocumento: string;
  fechaNacimiento: string;
  direccion: string;
  ciudad: string;
  tokenVerificacionHash: string;
  tokenVerificacionExpira: Date;
}

/** El usuario de una fundación nace verificado: su filtro es la validación del administrador. */
export type DatosNuevoUsuarioFundacion = DatosCuenta;

export interface UsuarioCreado {
  id: number;
  email: string;
}

export interface FiltroUsuarios {
  nombre?: string;
  correo?: string;
  rol?: RolNombre;
}

/** Vista del administrador: sin contraseña, hashes, tokens ni códigos. */
export interface UsuarioAdmin {
  id: number;
  email: string;
  telefono: string;
  rol: RolNombre;
  activo: boolean;
  emailVerificado: boolean;
  fechaCreacion: Date;
  /** Nombre completo del adoptante, nombre de la fundación o `null` (administrador). */
  nombre: string | null;
}
