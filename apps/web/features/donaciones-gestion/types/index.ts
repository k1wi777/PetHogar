export const TIPOS_DONACION = ['economica', 'especie'] as const;
export type TipoDonacion = (typeof TIPOS_DONACION)[number];
export const ETIQUETA_TIPO: Readonly<Record<TipoDonacion, string>> = {
  economica: 'Económica',
  especie: 'En especie',
};

export type OrigenDonacion = 'plataforma' | 'manual';
export const ETIQUETA_ORIGEN: Readonly<Record<OrigenDonacion, string>> = {
  plataforma: 'Desde PetHogar',
  manual: 'Registro manual',
};

export interface DonacionFundacion {
  id: number;
  tipo: TipoDonacion;
  /** Cadena con 2 decimales (p. ej. «50000.50»); nunca un número. */
  monto: string | null;
  descripcionEspecie: string | null;
  /** Instante ISO (se muestra en hora de Bogotá). */
  fecha: string;
  donante: { nombre: string; origen: OrigenDonacion };
  /** Ruta `/api/…` autenticada del comprobante, si existe. */
  comprobante: { url: string } | null;
}

/** Totales del conjunto filtrado completo (no de la página visible); el monto es una cadena. */
export interface TotalesDonaciones {
  economica: { cantidad: number; monto: string };
  especie: { cantidad: number };
}

export interface PaginaDonaciones {
  total: number;
  page: number;
  limit: number;
  data: DonacionFundacion[];
  totales: TotalesDonaciones;
}

export interface ConsultaDonaciones {
  pagina: number;
  /** AAAA-MM-DD (día de Bogotá), incluido. */
  desde?: string;
  hasta?: string;
  tipo?: TipoDonacion;
}

/** Aporte presencial; los campos que no corresponden al tipo no existen. */
export type DatosDonacionManual =
  | { tipo: 'economica'; nombreDonante: string; monto: string; comprobante?: File }
  | { tipo: 'especie'; nombreDonante: string; descripcion: string; comprobante?: File };

/** Respuesta de `POST /fundacion/donaciones`: resumen sin donante; `comprobante` solo indica si existe. */
export interface DonacionRegistrada {
  id: number;
  tipo: TipoDonacion;
  monto: string | null;
  descripcionEspecie: string | null;
  fecha: string;
  comprobante: boolean;
}
