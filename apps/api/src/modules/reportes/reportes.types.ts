import type { TipoDonacion } from '../donaciones/entities/donacion.enum';
import type { EstadoSolicitud } from '../solicitudes/entities/solicitud-adopcion.enum';
import type { EstadoBienestar, EstadoSeguimiento } from '../seguimientos/entities/seguimiento.enum';

/**
 * Filtro ya normalizado. Las fechas de día (`desde`/`hasta`, `AAAA-MM-DD`, incluidos) se comparan
 * tal cual con las columnas `date`; para las `timestamptz` se usan los instantes `desdeInstante` y
 * `hastaExclusivo` (días de Bogotá, intervalo semiabierto).
 */
export interface FiltroReporte {
  /** Ausente solo en el administrador sin filtro por fundación. */
  fundacionId?: number;
  desde?: string;
  hasta?: string;
  desdeInstante?: Date;
  hastaExclusivo?: Date;
}

/** Filtros aplicados tal como los ve el usuario (en la respuesta y en el encabezado de los PDF). */
export interface FiltrosAplicados {
  fundacionId: number | null;
  desde: string | null;
  hasta: string | null;
}

export interface FilaPorMes {
  mes: string;
  cantidad: number;
}

export interface FilaPorMesConMonto extends FilaPorMes {
  monto: string;
}

export interface FilaPorEspecie {
  especie: string;
  cantidad: number;
}

export interface FilaPorEstado<E extends string> {
  estado: E;
  cantidad: number;
}

export interface FilaPorBienestar {
  bienestar: EstadoBienestar;
  cantidad: number;
}

export interface FilaPorTipo {
  tipo: TipoDonacion;
  cantidad: number;
  monto: string;
}

export type CuentaPorEstado<E extends string> = Record<E, number>;

export interface Estadisticas {
  filtros: FiltrosAplicados;
  adopciones: { total: number; porMes: FilaPorMes[]; porEspecie: FilaPorEspecie[] };
  solicitudes: { total: number; porEstado: CuentaPorEstado<EstadoSolicitud> };
  seguimientos: {
    total: number;
    porEstado: CuentaPorEstado<EstadoSeguimiento>;
    porBienestar: CuentaPorEstado<EstadoBienestar>;
  };
  donaciones: {
    total: number;
    porMes: FilaPorMesConMonto[];
    porTipo: {
      economica: { cantidad: number; monto: string };
      especie: { cantidad: number };
    };
  };
}

/** Filas de los PDF de listado: solo columnas operativas; del adoptante, nombre y ciudad. */
export interface FilaSolicitudPdf {
  fecha: string;
  mascota: string;
  adoptante: string;
  ciudad: string;
  estado: EstadoSolicitud;
  observacion: string | null;
}

export interface FilaSeguimientoPdf {
  fecha: string;
  mascota: string;
  tipo: string;
  /** Con `vencido` calculado por fecha, como en los listados del módulo. */
  estado: EstadoSeguimiento;
  bienestar: EstadoBienestar | null;
  observaciones: string | null;
}

export interface FilaDonacionPdf {
  fecha: string;
  donante: string;
  tipo: TipoDonacion;
  monto: string | null;
  descripcion: string | null;
}

/** Filas (tope aplicado) y total real del conjunto filtrado. */
export interface Listado<F> {
  filas: F[];
  total: number;
}
