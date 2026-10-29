import { TipoDonacion } from '../donaciones/entities/donacion.enum';
import { EstadoBienestar, EstadoSeguimiento } from '../seguimientos/entities/seguimiento.enum';
import { EstadoSolicitud } from '../solicitudes/entities/solicitud-adopcion.enum';
import type {
  CuentaPorEstado,
  Estadisticas,
  FilaPorBienestar,
  FilaPorEspecie,
  FilaPorEstado,
  FilaPorMes,
  FilaPorMesConMonto,
  FilaPorTipo,
  FiltrosAplicados,
} from './reportes.types';

const suma = (valores: number[]): number => valores.reduce((a, b) => a + b, 0);

/** Todas las categorías del enum, con 0 cuando no hay datos. */
export function completarCuentas<K extends string>(
  categorias: readonly K[],
  filas: { clave: string; cantidad: number }[],
): CuentaPorEstado<K> {
  const cuentas = Object.fromEntries(categorias.map((c) => [c, 0])) as CuentaPorEstado<K>;
  for (const { clave, cantidad } of filas) {
    if (clave in cuentas) cuentas[clave as K] += cantidad;
  }
  return cuentas;
}

export interface DatosEstadisticas {
  filtros: FiltrosAplicados;
  adopcionesPorMes: FilaPorMes[];
  adopcionesPorEspecie: FilaPorEspecie[];
  solicitudes: FilaPorEstado<EstadoSolicitud>[];
  seguimientos: FilaPorEstado<EstadoSeguimiento>[];
  bienestar: FilaPorBienestar[];
  donacionesPorMes: FilaPorMesConMonto[];
  donacionesPorTipo: FilaPorTipo[];
}

/** Mapeo explícito: ninguna fila cruda llega a la respuesta. */
export function aEstadisticas(d: DatosEstadisticas): Estadisticas {
  const porEstadoSolicitud = completarCuentas(
    Object.values(EstadoSolicitud),
    d.solicitudes.map((f) => ({ clave: f.estado, cantidad: f.cantidad })),
  );
  const porEstadoSeguimiento = completarCuentas(
    Object.values(EstadoSeguimiento),
    d.seguimientos.map((f) => ({ clave: f.estado, cantidad: f.cantidad })),
  );
  const porBienestar = completarCuentas(
    Object.values(EstadoBienestar),
    d.bienestar.map((f) => ({ clave: f.bienestar, cantidad: f.cantidad })),
  );
  const economica = d.donacionesPorTipo.find((f) => f.tipo === TipoDonacion.Economica);
  const especie = d.donacionesPorTipo.find((f) => f.tipo === TipoDonacion.Especie);
  return {
    filtros: d.filtros,
    adopciones: {
      total: suma(d.adopcionesPorMes.map((f) => f.cantidad)),
      porMes: d.adopcionesPorMes.map((f) => ({ mes: f.mes, cantidad: f.cantidad })),
      porEspecie: d.adopcionesPorEspecie.map((f) => ({
        especie: f.especie,
        cantidad: f.cantidad,
      })),
    },
    solicitudes: {
      total: suma(Object.values(porEstadoSolicitud)),
      porEstado: porEstadoSolicitud,
    },
    seguimientos: {
      total: suma(Object.values(porEstadoSeguimiento)),
      porEstado: porEstadoSeguimiento,
      porBienestar,
    },
    donaciones: {
      total: (economica?.cantidad ?? 0) + (especie?.cantidad ?? 0),
      porMes: d.donacionesPorMes.map((f) => ({ mes: f.mes, cantidad: f.cantidad, monto: f.monto })),
      porTipo: {
        economica: { cantidad: economica?.cantidad ?? 0, monto: economica?.monto ?? '0.00' },
        especie: { cantidad: especie?.cantidad ?? 0 },
      },
    },
  };
}
