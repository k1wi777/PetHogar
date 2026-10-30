export type TipoDonacion = 'economica' | 'especie';

/** Respuesta de `POST /donaciones`. */
export interface DonacionRegistrada {
  id: number;
  fundacion: { id: number; nombre: string };
  tipo: TipoDonacion;
  /** Cadena con 2 decimales (p. ej. «50000.50»); nunca un número. */
  monto: string | null;
  descripcionEspecie: string | null;
  fecha: string;
  comprobante: boolean;
}

/** Fundación destinataria que llega por la URL desde la ficha de una mascota. */
export interface FundacionDestino {
  id: number;
  /** Solo presentación (recortado a 100 caracteres), nunca HTML. */
  nombre: string;
}
