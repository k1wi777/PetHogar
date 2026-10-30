export const ESTADOS_SOLICITUD = ['pendiente', 'aprobada', 'rechazada', 'cancelada'] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export const TIPOS_VIVIENDA = ['casa', 'apartamento', 'finca'] as const;
export type TipoVivienda = (typeof TIPOS_VIVIENDA)[number];

export const ETIQUETA_VIVIENDA: Readonly<Record<TipoVivienda, string>> = {
  casa: 'Casa',
  apartamento: 'Apartamento',
  finca: 'Finca',
};

/** Fila de «Solicitudes recibidas» (`GET /fundacion/solicitudes`). */
export interface ResumenSolicitudRecibida {
  id: number;
  fechaSolicitud: string;
  estado: EstadoSolicitud;
  mascota: { id: number; nombre: string };
  adoptante: { nombreCompleto: string };
}

/** Adopción creada al aprobar (solo viene en la respuesta de la decisión y en el detalle aprobado). */
export interface AdopcionCreada {
  id: number;
  fechaEntrega: string;
  estado: string;
}

/** Detalle para la fundación: nunca trae documento ni dirección del adoptante. */
export interface DetalleSolicitudRecibida extends ResumenSolicitudRecibida {
  motivo: string;
  tipoVivienda: TipoVivienda;
  tieneOtrasMascotas: boolean;
  observacion: string | null;
  fechaRespuesta: string | null;
  adoptante: { nombreCompleto: string; email: string; telefono: string; ciudad: string };
  formulario: { url: string };
  adopcion?: AdopcionCreada | null;
}

export interface ConsultaSolicitudes {
  pagina: number;
  estado?: EstadoSolicitud;
  mascotaId?: number;
}

export type Decision = 'aprobar' | 'rechazar';

/** Cuerpo de `PATCH /solicitudes/:id/decision`; lo que no corresponde a la decisión no se envía. */
export type DatosDecision =
  | { decision: 'aprobar'; fechaEntrega: string; observacion?: string }
  | { decision: 'rechazar'; observacion: string };

/** Lo mínimo de una mascota de la fundación para el selector del filtro. */
export interface MascotaParaFiltro {
  id: number;
  nombre: string;
}
