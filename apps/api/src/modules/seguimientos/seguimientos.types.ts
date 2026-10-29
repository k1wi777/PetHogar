import type { EstadoAdopcion } from '../adopciones/entities/adopcion.enum';
import type {
  EstadoBienestar,
  EstadoSeguimiento,
  TipoSeguimiento,
} from './entities/seguimiento.enum';

/** Rol que consulta: decide la propiedad en la misma sentencia. */
export type PropietarioSeguimiento =
  { tipo: 'fundacion'; fundacionId: number } | { tipo: 'adoptante'; usuarioId: number };

export interface SeguimientoBase {
  id: number;
  adopcionId: number;
  tipo: TipoSeguimiento;
  /** `YYYY-MM-DD`. */
  fechaProgramada: string;
  fechaRealizada: string | null;
  estado: EstadoSeguimiento;
  /** `vencido` o `programado` con la fecha anterior a hoy (no espera al cron). */
  vencido: boolean;
  tieneReporte: boolean;
  mascota: { id: number; nombre: string };
}

/** La fundación ve el nombre del adoptante en la lista. */
export interface SeguimientoListaFundacion extends SeguimientoBase {
  adoptante: { nombreCompleto: string };
}

/** El adoptante ve de la fundación solo su nombre. */
export interface SeguimientoListaAdoptante extends SeguimientoBase {
  fundacion: { nombre: string };
}

/** Referencia a una foto; la clave de almacenamiento nunca sale del repository. */
export interface FotoSeguimiento {
  id: number;
}

export interface ReporteAdoptante {
  comentarios: string;
  enviadoEn: Date;
  fotos: FotoSeguimiento[];
}

export interface SeguimientoDetalleFundacion extends SeguimientoListaFundacion {
  fechaEntrega: string;
  estadoBienestar: EstadoBienestar | null;
  observaciones: string | null;
  reporte: ReporteAdoptante | null;
  evidencias: FotoSeguimiento[];
}

/** El adoptante nunca ve bienestar, observaciones ni evidencias de la fundación. */
export interface SeguimientoDetalleAdoptante extends SeguimientoListaAdoptante {
  fechaEntrega: string;
  reporte: ReporteAdoptante | null;
}

export interface FiltroSeguimientos {
  estado?: EstadoSeguimiento;
  tipo?: TipoSeguimiento;
  adopcionId?: number;
}

/** Resumen que acompaña a cada adopción en sus listados. */
export interface ResumenSeguimiento {
  id: number;
  tipo: TipoSeguimiento;
  fechaProgramada: string;
  fechaRealizada: string | null;
  estado: EstadoSeguimiento;
  vencido: boolean;
}

/** Adopción bloqueada para programar: propiedad comprobada en la misma sentencia. */
export interface AdopcionParaProgramar {
  id: number;
  estado: EstadoAdopcion;
  fechaEntrega: string;
  mascotaId: number;
}

/** Seguimiento bloqueado (o leído) por su dueño, con lo que hace falta para decidir. */
export interface SeguimientoParaAccion {
  id: number;
  adopcionId: number;
  mascotaId: number;
  fundacionId: number;
  tipo: TipoSeguimiento;
  estado: EstadoSeguimiento;
  fechaEntrega: string;
  reporteEnviadoEn: Date | null;
}

export interface DatosResultado {
  fechaRealizada: string;
  estadoBienestar: EstadoBienestar;
  observaciones: string;
}

/** Fila afectada por una tarea programada. */
export interface SeguimientoDeTarea {
  id: number;
  adopcionId: number;
  /** `YYYY-MM-DD`. */
  fechaProgramada: string;
}

/** Dueño que ya pasó por la resolución de usuario a adoptante: es lo que filtra las sentencias. */
export type DuenoSeguimiento =
  { tipo: 'fundacion'; fundacionId: number } | { tipo: 'adoptante'; adoptanteId: number };
