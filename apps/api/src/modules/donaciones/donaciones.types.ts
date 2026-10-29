import type { TipoDonacion } from './entities/donacion.enum';

/** Resumen devuelto al registrar: sin claves de almacenamiento ni datos internos. */
export interface DonacionResumen {
  id: number;
  fundacion: { id: number; nombre: string };
  tipo: TipoDonacion;
  /** Cadena con 2 decimales (`"50000.00"`); `null` en una donación en especie. */
  monto: string | null;
  descripcionEspecie: string | null;
  fecha: Date;
  comprobante: boolean;
}

export type OrigenDonacion = 'plataforma' | 'manual';

export interface DonacionDeFundacion {
  id: number;
  tipo: TipoDonacion;
  monto: string | null;
  descripcionEspecie: string | null;
  fecha: Date;
  /** Solo el nombre y el origen del registro: nunca correo, teléfono ni documento. */
  donante: { nombre: string; origen: OrigenDonacion };
  comprobante: { url: string } | null;
}

export interface TotalesDonaciones {
  economica: { cantidad: number; monto: string };
  especie: { cantidad: number };
}

export interface DonacionesDeFundacion {
  data: DonacionDeFundacion[];
  total: number;
  page: number;
  limit: number;
  totales: TotalesDonaciones;
}

/** Filtro ya normalizado: instantes UTC (periodo semiabierto) y tipo. */
export interface FiltroDonaciones {
  desde?: Date;
  /** Exclusivo: el inicio del día siguiente al último día pedido. */
  hastaExclusivo?: Date;
  tipo?: TipoDonacion;
}

export interface DatosNuevaDonacion {
  fundacionId: number;
  usuarioId: number | null;
  nombreDonante: string | null;
  tipo: TipoDonacion;
  monto: string | null;
  descripcionEspecie: string | null;
  comprobanteClave: string | null;
}

export interface DonacionGuardada {
  id: number;
  fecha: Date;
  monto: string | null;
}

export interface FilaDonacion {
  id: number;
  tipo: TipoDonacion;
  monto: string | null;
  descripcionEspecie: string | null;
  fecha: Date;
  usuarioId: number | null;
  nombreDonante: string | null;
  tieneComprobante: boolean;
}

export interface FilaAgregado {
  tipo: TipoDonacion;
  cantidad: number;
  monto: string;
}

/** Para los avisos: lo mínimo de una donación. */
export interface DonacionParaAviso {
  tipo: TipoDonacion;
  monto: string | null;
  descripcionEspecie: string | null;
  fecha: Date;
  usuarioId: number | null;
}
