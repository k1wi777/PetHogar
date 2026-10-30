export const ESTADOS_SOLICITUD = ['pendiente', 'aprobada', 'rechazada', 'cancelada'] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export const TIPOS_VIVIENDA = ['casa', 'apartamento', 'finca'] as const;
export type TipoVivienda = (typeof TIPOS_VIVIENDA)[number];

export const ETIQUETA_VIVIENDA: Readonly<Record<TipoVivienda, string>> = {
  casa: 'Casa',
  apartamento: 'Apartamento',
  finca: 'Finca',
};

/** Fila de «Mis solicitudes» (`GET /mis-solicitudes`). */
export interface ResumenSolicitud {
  id: number;
  fechaSolicitud: string;
  estado: EstadoSolicitud;
  mascota: { id: number; nombre: string };
  fundacion: { nombre: string };
}

/** Detalle (`GET /mis-solicitudes/:id`, creación y cancelación). */
export interface DetalleSolicitud extends ResumenSolicitud {
  motivo: string;
  tipoVivienda: TipoVivienda;
  tieneOtrasMascotas: boolean;
  /** Observación de la fundación al aprobar o rechazar. */
  observacion: string | null;
  fechaRespuesta: string | null;
  formulario: { url: string };
}

/** Lo mínimo de la ficha pública que necesita la solicitud (no se importa `catalogo`). */
export interface MascotaParaSolicitar {
  id: number;
  nombre: string;
  fundacion: { id: number; nombre: string; ciudad: string };
}

export interface ConsultaSolicitudes {
  pagina: number;
  estado?: EstadoSolicitud;
}
