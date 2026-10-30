export const ESTADOS_VALIDACION = ['pendiente', 'aprobada', 'rechazada'] as const;
export type EstadoValidacion = (typeof ESTADOS_VALIDACION)[number];

/** Estado que el backend usa cuando no se pide otro (`GET /admin/fundaciones`). */
export const ESTADO_POR_DEFECTO: EstadoValidacion = 'pendiente';

/** Fila de la lista (`GET /admin/fundaciones`). */
export interface ResumenFundacion {
  id: number;
  nombre: string;
  nit: string;
  ciudad: string;
  estadoValidacion: EstadoValidacion;
  fechaValidacion: string | null;
}

/** Detalle (`GET /admin/fundaciones/:id`): `documento.url` es la ruta de descarga, nunca una clave de storage. */
export interface DetalleFundacion extends ResumenFundacion {
  direccion: string;
  descripcion: string | null;
  observacionValidacion: string | null;
  contacto: { email: string; telefono: string };
  documento: { url: string };
}

export interface PaginaFundaciones {
  data: ResumenFundacion[];
  total: number;
  page: number;
  limit: number;
}

export interface ConsultaFundaciones {
  pagina: number;
  estado: EstadoValidacion;
}

export type DecisionValidacion = 'aprobada' | 'rechazada';

/** Cuerpo de `PATCH /admin/fundaciones/:id/validacion`. */
export interface DatosValidacion {
  decision: DecisionValidacion;
  observacion?: string;
}
