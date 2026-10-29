import { EstadoValidacion } from './entities/fundacion.enum';

export interface DatosNuevaFundacion {
  usuarioId: number;
  nombre: string;
  nit: string;
  direccion: string;
  ciudad: string;
  descripcion: string | null;
  /** Clave del documento legal en el almacenamiento privado (no una URL). */
  documentoClave: string;
}

export interface EstadoFundacion {
  estadoValidacion: EstadoValidacion;
  /** Solo se informa si la fundación fue rechazada. */
  observacionValidacion: string | null;
}

export interface FundacionResumen extends EstadoFundacion {
  id: number;
  nombre: string;
}

export type DecisionValidacion = EstadoValidacion.Aprobada | EstadoValidacion.Rechazada;

/**
 * Máquina de estados de la validación: destino → orígenes permitidos. `rechazada → aprobada`
 * corrige un rechazo (el NIT y el correo son únicos, no se puede registrar de nuevo); `aprobada →
 * rechazada` no existe porque ya puede haber mascotas y adopciones en curso (se desactiva la cuenta).
 */
export const TRANSICIONES: Record<DecisionValidacion, readonly EstadoValidacion[]> = {
  [EstadoValidacion.Aprobada]: [EstadoValidacion.Pendiente, EstadoValidacion.Rechazada],
  [EstadoValidacion.Rechazada]: [EstadoValidacion.Pendiente],
};

/** Vista de listado para el administrador. */
export interface FundacionAdminResumen {
  id: number;
  nombre: string;
  nit: string;
  ciudad: string;
  estadoValidacion: EstadoValidacion;
  fechaValidacion: Date | null;
}

/** Vista de detalle para el administrador; `usuarioId` es interno (no se serializa). */
export interface FundacionAdminDetalle extends FundacionAdminResumen {
  usuarioId: number;
  direccion: string;
  descripcion: string | null;
  observacionValidacion: string | null;
}
