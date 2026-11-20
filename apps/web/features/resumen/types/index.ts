/**
 * Solo los campos que el resumen lee. Duplican a propósito los tipos de otras features: la regla
 * feature-first prohíbe importarlas.
 */
export type EstadoMascota = 'disponible' | 'en_proceso' | 'adoptada' | 'inactiva';
export const ESTADOS_MASCOTA_RESUMEN: readonly EstadoMascota[] = [
  'disponible',
  'en_proceso',
  'adoptada',
  'inactiva',
];

export interface ResumenSolicitud {
  id: number;
  fechaSolicitud: string;
  estado: string;
  mascota: { id: number; nombre: string };
  fundacion: { nombre: string };
}

export interface ResumenSolicitudRecibida {
  id: number;
  fechaSolicitud: string;
  estado: string;
  mascota: { id: number; nombre: string };
  adoptante: { nombreCompleto: string };
}

export interface ResumenAdopcion {
  id: number;
  fechaEntrega: string;
  mascota: { id: number; nombre: string };
  fundacion: { nombre: string };
}

export interface ResumenSeguimiento {
  id: number;
  tipo: 'visita' | 'reporte';
  /** AAAA-MM-DD. */
  fechaProgramada: string;
  estado: string;
  vencido: boolean;
  mascota: { id: number; nombre: string };
}

/** Seguimientos tal como los entregan ambos roles (cada uno añade su contraparte). */
export interface SeguimientoDeLista extends ResumenSeguimiento {
  fundacion?: { nombre: string };
  adoptante?: { nombreCompleto: string };
}

export interface ResumenDonacion {
  id: number;
  tipo: 'economica' | 'especie';
  /** Cadena decimal del servidor; nunca se convierte a número. */
  monto: string | null;
  descripcionEspecie: string | null;
  fecha: string;
  donante: { nombre: string };
}

export interface TotalesDonacionesMes {
  economica: { cantidad: number; monto: string };
  especie: { cantidad: number };
}

export interface PaginaDonacionesMes {
  total: number;
  page: number;
  limit: number;
  data: ResumenDonacion[];
  totales: TotalesDonacionesMes;
}

export interface FundacionPorValidar {
  id: number;
  nombre: string;
  ciudad: string;
}

export interface ExtractoEstadisticas {
  adopciones: { total: number };
  solicitudes: { total: number; porEstado: { pendiente: number } };
  seguimientos: { porEstado: { vencido: number } };
  donaciones: { total: number; porTipo: { economica: { monto: string } } };
}

export interface NoLeidasResumen {
  noLeidas: number;
}

/** Cifras de seguimientos ya calculadas (D3) y las filas destacadas. */
export interface ResumenSeguimientos {
  vencidos: number;
  programados: number;
  /** El total de programados superó la lista pedida: el cálculo por fecha puede ser parcial. */
  parcial: boolean;
  destacados: SeguimientoDeLista[];
}
