import type { DonacionResumenDto } from './dto/respuestas.dto';
import type {
  DonacionDeFundacion,
  DonacionResumen,
  FilaAgregado,
  TotalesDonaciones,
} from './donaciones.types';
import { TipoDonacion } from './entities/donacion.enum';

export const urlComprobante = (id: number): string => `/api/fundacion/donaciones/${id}/comprobante`;

/** Mapeo explícito: solo los campos públicos del resumen, nunca la clave del comprobante. */
export function aResumenDto(resumen: DonacionResumen): DonacionResumenDto {
  return {
    id: resumen.id,
    fundacion: { id: resumen.fundacion.id, nombre: resumen.fundacion.nombre },
    tipo: resumen.tipo,
    monto: resumen.monto,
    descripcionEspecie: resumen.descripcionEspecie,
    fecha: resumen.fecha,
    comprobante: resumen.comprobante,
  };
}

export function aDonacionFundacionDto(donacion: DonacionDeFundacion): DonacionDeFundacion {
  return {
    id: donacion.id,
    tipo: donacion.tipo,
    monto: donacion.monto,
    descripcionEspecie: donacion.descripcionEspecie,
    fecha: donacion.fecha,
    donante: { nombre: donacion.donante.nombre, origen: donacion.donante.origen },
    comprobante: donacion.comprobante ? { url: donacion.comprobante.url } : null,
  };
}

/** Ceros cuando el filtro no devuelve filas de un tipo; el monto siempre es una cadena. */
export function construirTotales(agregado: readonly FilaAgregado[]): TotalesDonaciones {
  const economica = agregado.find((fila) => fila.tipo === TipoDonacion.Economica);
  const especie = agregado.find((fila) => fila.tipo === TipoDonacion.Especie);
  return {
    economica: { cantidad: economica?.cantidad ?? 0, monto: economica?.monto ?? '0.00' },
    especie: { cantidad: especie?.cantidad ?? 0 },
  };
}

export const totalDeFilas = (agregado: readonly FilaAgregado[]): number =>
  agregado.reduce((suma, fila) => suma + fila.cantidad, 0);
