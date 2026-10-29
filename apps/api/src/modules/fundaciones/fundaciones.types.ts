import type { EstadoValidacion } from './entities/fundacion.enum';

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
