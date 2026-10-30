export type TipoSeguimiento = 'visita' | 'reporte';
export type EstadoSeguimiento = 'programado' | 'realizado' | 'vencido' | 'cancelado';
export type EstadoAdopcion = 'activa' | 'finalizada' | 'revocada';

/** Máximo de seguimientos que la API incluye por adopción (los más recientes). */
export const MAX_SEGUIMIENTOS_RESUMEN = 20;

export interface ResumenSeguimiento {
  id: number;
  tipo: TipoSeguimiento;
  /** AAAA-MM-DD. */
  fechaProgramada: string;
  fechaRealizada: string | null;
  estado: EstadoSeguimiento;
  /** La API lo marca también por fecha anterior a hoy aunque el estado siga programado. */
  vencido: boolean;
}

export interface AdopcionAdoptante {
  id: number;
  fechaEntrega: string;
  estado: EstadoAdopcion;
  solicitudId: number;
  mascota: { id: number; nombre: string };
  fundacion: { nombre: string; ciudad: string };
  motivoCierre: string | null;
  fechaCierre: string | null;
  /** Ruta `/api/mis-adopciones/:id/acta` autenticada; nula si la fundación aún no subió el acta. */
  acta: { url: string } | null;
  seguimientos: ResumenSeguimiento[];
}

export interface ReporteEnviado {
  comentarios: string;
  enviadoEn: string;
  fotos: Array<{ id: number; url: string }>;
}

export interface DetalleSeguimiento extends ResumenSeguimiento {
  adopcionId: number;
  tieneReporte: boolean;
  mascota: { id: number; nombre: string };
  fundacion: { nombre: string };
  fechaEntrega: string;
  reporte: ReporteEnviado | null;
}
