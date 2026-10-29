import type { EstadoSolicitud } from './entities/solicitud-adopcion.enum';

export const TIPOS_VIVIENDA = ['casa', 'apartamento', 'finca'] as const;
export type TipoVivienda = (typeof TIPOS_VIVIENDA)[number];

export const MENSAJE_SOLICITUD_NO_EXISTE = 'La solicitud no existe';

export interface DatosNuevaSolicitud {
  adoptanteId: number;
  mascotaId: number;
  motivo: string;
  tipoVivienda: TipoVivienda;
  tieneOtrasMascotas: boolean;
  /** Clave del formulario en el almacenamiento privado (nunca sale en una respuesta). */
  formularioClave: string;
}

interface MascotaResumen {
  id: number;
  nombre: string;
}

interface DatosSolicitud {
  motivo: string;
  tipoVivienda: string;
  tieneOtrasMascotas: boolean;
  observacion: string | null;
  fechaRespuesta: Date | null;
}

interface Cabecera {
  id: number;
  fechaSolicitud: Date;
  estado: EstadoSolicitud;
  mascota: MascotaResumen;
}

/** Lista del adoptante: de la fundación solo se muestra el nombre. */
export interface SolicitudResumenAdoptante extends Cabecera {
  fundacion: { nombre: string };
}

export interface SolicitudDetalleAdoptante extends SolicitudResumenAdoptante, DatosSolicitud {}

/** Datos mínimos del adoptante que la fundación necesita para valorar y contactar. */
export interface AdoptanteContacto {
  nombreCompleto: string;
  email: string;
  telefono: string;
  ciudad: string;
}

export interface SolicitudResumenFundacion extends Cabecera {
  adoptante: { nombreCompleto: string };
}

export interface SolicitudDetalleFundacion extends Cabecera, DatosSolicitud {
  adoptante: AdoptanteContacto;
}

export interface FiltroSolicitudesAdoptante {
  estado?: EstadoSolicitud;
}

export interface FiltroSolicitudesFundacion {
  estado?: EstadoSolicitud;
  mascotaId?: number;
}

/** Solicitud recién decidida: lo que hace falta para la mascota y los eventos. */
export interface SolicitudDecidida {
  id: number;
  mascotaId: number;
  adoptanteId: number;
}

/** Quién reclama un formulario: su fundación dueña o su adoptante autor. */
export type PropietarioSolicitud =
  { tipo: 'fundacion'; fundacionId: number } | { tipo: 'adoptante'; usuarioId: number };
