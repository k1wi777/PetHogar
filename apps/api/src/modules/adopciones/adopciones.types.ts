import type { EstadoAdopcion } from './entities/adopcion.enum';
import type { ResumenSeguimiento } from '../seguimientos/seguimientos.types';
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
  /** Motivo y fecha con que se finalizó o revocó; nulos mientras la adopción siga activa. */
  motivoCierre: string | null;
  fechaCierre: Date | null;
  /** Hasta los 20 seguimientos más recientes (los resuelve el service con una sola consulta). */
  seguimientos: ResumenSeguimiento[];
}

/** Lo que devuelve el repository: los seguimientos los añade el service. */
export type SinSeguimientos<T> = Omit<T, 'seguimientos'>;

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

/** Adopción bloqueada para cerrarla: propiedad comprobada en la misma sentencia. */
export interface AdopcionParaCierre {
  id: number;
  estado: EstadoAdopcion;
  mascotaId: number;
  adoptanteId: number;
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
