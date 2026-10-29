import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { TipoDonacion } from '../../../donaciones/entities/donacion.enum';
import type {
  FilaDonacionPdf,
  FilaPorTipo,
  FilaSeguimientoPdf,
  FilaSolicitudPdf,
  Listado,
} from '../../reportes.types';
import { avisoDeFilas, celda, documento, LAYOUT_TABLA } from '../documento';

export interface DatosListado<F> {
  listado: Listado<F>;
  /** Filtros ya redactados para el encabezado (los ausentes, `null`). */
  filtros: (string | null)[];
  generadoEn: Date;
  logoSvg: string;
}

const ETIQUETA_SOLICITUD: Record<string, string> = {
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
};
const ETIQUETA_SEGUIMIENTO: Record<string, string> = {
  programado: 'Programado',
  realizado: 'Realizado',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
};
const ETIQUETA_TIPO_SEGUIMIENTO: Record<string, string> = { visita: 'Visita', reporte: 'Reporte' };
const ETIQUETA_BIENESTAR: Record<string, string> = {
  bueno: 'Bueno',
  regular: 'Regular',
  malo: 'Malo',
};

const encabezados = (...titulos: string[]): TableCell[] =>
  titulos.map((t) => ({ text: t, bold: true }));

function tabla(anchos: (number | string)[], titulos: string[], filas: TableCell[][]): Content {
  return {
    layout: LAYOUT_TABLA,
    fontSize: 9,
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths: anchos,
      body: [encabezados(...titulos), ...filas],
    },
  };
}

/** Formatea `1500000.50` → `$ 1.500.000,50` sin pasar por `Number` (el monto es exacto). */
export function pesos(monto: string | null): string {
  if (monto === null) return '—';
  const [entero, decimales = '00'] = monto.split('.');
  const conPuntos = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$ ${conPuntos},${decimales.padEnd(2, '0').slice(0, 2)}`;
}

function cuerpo<F>(
  listado: Listado<F>,
  tablaDe: (filas: F[]) => Content,
  extra: Content[] = [],
): Content[] {
  if (listado.total === 0) return [avisoDeFilas(0, 0), ...extra];
  return [tablaDe(listado.filas), avisoDeFilas(listado.filas.length, listado.total), ...extra];
}

export function plantillaSolicitudes(d: DatosListado<FilaSolicitudPdf>): TDocumentDefinitions {
  return documento({
    titulo: 'Solicitudes de adopción',
    filtros: d.filtros,
    generadoEn: d.generadoEn,
    logoSvg: d.logoSvg,
    contenido: cuerpo(d.listado, (filas) =>
      tabla(
        [55, 70, '*', 60, 62, 100],
        ['Fecha', 'Mascota', 'Adoptante', 'Ciudad', 'Estado', 'Observación'],
        filas.map((f) => [
          f.fecha,
          f.mascota,
          f.adoptante,
          f.ciudad,
          ETIQUETA_SOLICITUD[f.estado] ?? f.estado,
          celda(f.observacion),
        ]),
      ),
    ),
  });
}

export function plantillaSeguimientos(d: DatosListado<FilaSeguimientoPdf>): TDocumentDefinitions {
  return documento({
    titulo: 'Seguimientos post-adopción',
    filtros: d.filtros,
    generadoEn: d.generadoEn,
    logoSvg: d.logoSvg,
    contenido: cuerpo(d.listado, (filas) =>
      tabla(
        [55, 70, 50, 62, 52, '*'],
        ['Fecha', 'Mascota', 'Tipo', 'Estado', 'Bienestar', 'Observaciones'],
        filas.map((f) => [
          f.fecha,
          f.mascota,
          ETIQUETA_TIPO_SEGUIMIENTO[f.tipo] ?? f.tipo,
          ETIQUETA_SEGUIMIENTO[f.estado] ?? f.estado,
          f.bienestar ? (ETIQUETA_BIENESTAR[f.bienestar] ?? f.bienestar) : '—',
          celda(f.observaciones),
        ]),
      ),
    ),
  });
}

export function plantillaDonaciones(
  d: DatosListado<FilaDonacionPdf> & { totales: FilaPorTipo[] },
): TDocumentDefinitions {
  const economica = d.totales.find((t) => t.tipo === TipoDonacion.Economica);
  const especie = d.totales.find((t) => t.tipo === TipoDonacion.Especie);
  const resumen: Content = {
    margin: [0, 12, 0, 0],
    stack: [
      { text: 'Totales del periodo', bold: true, fontSize: 11 },
      {
        text: `Económicas: ${economica?.cantidad ?? 0} · ${pesos(economica?.monto ?? '0.00')}`,
        margin: [0, 3, 0, 0],
      },
      { text: `En especie: ${especie?.cantidad ?? 0}` },
    ],
  };
  return documento({
    titulo: 'Donaciones recibidas',
    filtros: d.filtros,
    generadoEn: d.generadoEn,
    logoSvg: d.logoSvg,
    contenido: cuerpo(
      d.listado,
      (filas) =>
        tabla(
          [55, '*', 60, '*'],
          ['Fecha', 'Donante', 'Tipo', 'Monto o descripción'],
          filas.map((f) => [
            f.fecha,
            f.donante,
            f.tipo === TipoDonacion.Economica ? 'Económica' : 'En especie',
            f.tipo === TipoDonacion.Economica ? pesos(f.monto) : celda(f.descripcion),
          ]),
        ),
      [resumen],
    ),
  });
}
