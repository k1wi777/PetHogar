export const ESTADOS_ADOPCION = ['activa', 'finalizada', 'revocada'] as const;
export type EstadoAdopcion = (typeof ESTADOS_ADOPCION)[number];

export const TIPOS_SEGUIMIENTO = ['visita', 'reporte'] as const;
export type TipoSeguimiento = (typeof TIPOS_SEGUIMIENTO)[number];
export type EstadoSeguimiento = 'programado' | 'realizado' | 'vencido' | 'cancelado';

export const ESTADOS_BIENESTAR = ['bueno', 'regular', 'malo'] as const;
export type EstadoBienestar = (typeof ESTADOS_BIENESTAR)[number];
export const ETIQUETA_BIENESTAR: Readonly<Record<EstadoBienestar, string>> = {
  bueno: 'Bueno',
  regular: 'Regular',
  malo: 'Malo',
};
export const ETIQUETA_TIPO: Readonly<Record<TipoSeguimiento, string>> = {
  visita: 'Visita',
  reporte: 'Reporte del adoptante',
};

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

export interface AdoptanteContacto {
  nombreCompleto: string;
  email: string;
  telefono: string;
  ciudad: string;
}

/** Cierre de una adopción activa (el backend solo admite estas dos). */
export const ESTADOS_CIERRE = ['finalizada', 'revocada'] as const;
export type EstadoCierre = (typeof ESTADOS_CIERRE)[number];

/** Estado al que pasa la mascota cuando se revoca la adopción. */
export const DESTINOS_MASCOTA = ['disponible', 'inactiva'] as const;
export type DestinoMascota = (typeof DESTINOS_MASCOTA)[number];

/** Acta firmada: ruta `/api/…` autenticada (nunca una URL pública). */
export interface ActaAdopcion {
  url: string;
}

/** Fila de «Adopciones» (`GET /fundacion/adopciones`); trae adoptante y seguimientos. */
export interface AdopcionFundacion {
  id: number;
  fechaEntrega: string;
  estado: EstadoAdopcion;
  solicitudId: number;
  mascota: { id: number; nombre: string };
  motivoCierre: string | null;
  fechaCierre: string | null;
  acta: ActaAdopcion | null;
  adoptante: AdoptanteContacto;
  seguimientos: ResumenSeguimiento[];
}

export interface FotoPrivada {
  id: number;
  /** Ruta `/api/…` autenticada. */
  url: string;
}

export interface ReporteAdoptante {
  comentarios: string;
  enviadoEn: string;
  fotos: FotoPrivada[];
}

export interface DetalleSeguimientoFundacion extends ResumenSeguimiento {
  adopcionId: number;
  tieneReporte: boolean;
  mascota: { id: number; nombre: string };
  adoptante: { nombreCompleto: string };
  fechaEntrega: string;
  estadoBienestar: EstadoBienestar | null;
  observaciones: string | null;
  reporte: ReporteAdoptante | null;
  evidencias: FotoPrivada[];
}

export interface ConsultaAdopciones {
  pagina: number;
  estado?: EstadoAdopcion;
}

export interface DatosProgramar {
  tipo: TipoSeguimiento;
  fechaProgramada: string;
}

export interface DatosResultado {
  fechaRealizada: string;
  estadoBienestar: EstadoBienestar;
  observaciones: string;
  evidencias: File[];
}

/** Cuerpo de `PATCH /adopciones/:id/estado`; el destino solo existe al revocar. */
export type DatosCierre =
  | { estado: 'finalizada'; motivo: string }
  | { estado: 'revocada'; motivo: string; mascotaDestino: DestinoMascota };
