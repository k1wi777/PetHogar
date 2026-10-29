import type { EstadoAdopcion } from './entities/adopcion.enum';
import type { AdoptanteContacto } from '../solicitudes/solicitudes.types';

export const MENSAJE_ADOPCION_NO_EXISTE = 'La adopción no existe';

export interface AdopcionBase {
  id: number;
  /** `YYYY-MM-DD`. */
  fechaEntrega: string;
  estado: EstadoAdopcion;
  solicitudId: number;
  mascota: { id: number; nombre: string };
  /** La clave del acta no sale del servicio: solo si existe o no. */
  tieneActa: boolean;
}

/** El adoptante ve de la fundación solo su nombre y ciudad. */
export interface AdopcionDeAdoptante extends AdopcionBase {
  fundacion: { nombre: string; ciudad: string };
}

/** La fundación ve los datos mínimos del adoptante (los mismos que en la solicitud). */
export interface AdopcionDeFundacion extends AdopcionBase {
  adoptante: AdoptanteContacto;
}

export interface FiltroAdopciones {
  estado?: EstadoAdopcion;
}

export interface ResumenAdopcion {
  id: number;
  fechaEntrega: string;
  estado: EstadoAdopcion;
}

/** Fila bloqueada para subir el acta: estado vigente y clave anterior (a borrar tras el commit). */
export interface AdopcionParaActa {
  estado: EstadoAdopcion;
  actaClave: string | null;
}

export type PropietarioAdopcion =
  { tipo: 'fundacion'; fundacionId: number } | { tipo: 'adoptante'; usuarioId: number };
