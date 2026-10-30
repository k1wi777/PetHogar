export const AMBITOS = ['fundacion', 'administrador'] as const;
export type Ambito = (typeof AMBITOS)[number];

export const TIPOS_REPORTE = ['adopciones', 'solicitudes', 'seguimientos', 'donaciones'] as const;
export type TipoReporte = (typeof TIPOS_REPORTE)[number];

export const ETIQUETA_REPORTE: Readonly<Record<TipoReporte, string>> = {
  adopciones: 'Adopciones',
  solicitudes: 'Solicitudes',
  seguimientos: 'Seguimientos',
  donaciones: 'Donaciones',
};

/** Reportes con PDF en el backend (no existe PDF de adopciones). */
export const TIPOS_CON_PDF: ReadonlyArray<TipoReporte> = [
  'solicitudes',
  'seguimientos',
  'donaciones',
];

export interface PorMes {
  mes: string;
  cantidad: number;
}

export interface PorMesConMonto extends PorMes {
  /** Cadena decimal del servidor; nunca se suma con `Number`. */
  monto: string;
}

/** Respuesta de `GET /fundacion/estadisticas` y `GET /admin/estadisticas`. */
export interface EstadisticasDto {
  filtros: { fundacionId: number | null; desde: string | null; hasta: string | null };
  adopciones: {
    total: number;
    porMes: PorMes[];
    porEspecie: Array<{ especie: string; cantidad: number }>;
  };
  solicitudes: {
    total: number;
    porEstado: { pendiente: number; aprobada: number; rechazada: number; cancelada: number };
  };
  seguimientos: {
    total: number;
    porEstado: { programado: number; realizado: number; vencido: number; cancelado: number };
    porBienestar: { bueno: number; regular: number; malo: number };
  };
  donaciones: {
    total: number;
    porMes: PorMesConMonto[];
    porTipo: { economica: { cantidad: number; monto: string }; especie: { cantidad: number } };
  };
}

/** Lo que se pide al servidor (el reporte elegido no es parte de la petición). */
export interface ConsultaEstadisticas {
  desde?: string;
  hasta?: string;
  /** Solo en el ámbito administrador. */
  fundacionId?: number;
}

/** Estado de la pantalla en la URL. */
export interface ConsultaReportes {
  reporte: TipoReporte;
  desde?: string;
  hasta?: string;
  fundacion?: number;
}

export interface FundacionAprobada {
  id: number;
  nombre: string;
}
