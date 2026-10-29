import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { ZONA_HORARIA } from '../../../common/validation/fecha';

const COLOR_MARCA = '#0f766e';
const formatoFecha = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA_HORARIA,
  dateStyle: 'long',
  timeStyle: 'short',
});

export function fechaLegible(fecha: Date): string {
  return formatoFecha.format(fecha);
}

/** Etiqueta de un filtro (`Estado: pendiente`); los filtros ausentes no se listan. */
export function filtro(nombre: string, valor: string | undefined | null): string | null {
  return valor ? `${nombre}: ${valor}` : null;
}

export interface EntradaDocumento {
  titulo: string;
  /** Filtros aplicados; vacío o `null` ⇒ «Sin filtros». */
  filtros: (string | null)[];
  generadoEn: Date;
  logoSvg: string;
  contenido: Content[];
}

/** Encabezado común: logo, título, fecha de generación y filtros aplicados. */
export function encabezado(
  entrada: Pick<EntradaDocumento, 'titulo' | 'filtros' | 'generadoEn' | 'logoSvg'>,
): Content {
  const filtros = entrada.filtros.filter((f): f is string => !!f);
  return {
    stack: [
      {
        columns: [
          { svg: entrada.logoSvg, width: 44 },
          {
            stack: [
              { text: 'PetHogar', color: COLOR_MARCA, bold: true, fontSize: 11 },
              { text: entrada.titulo, bold: true, fontSize: 17, margin: [0, 2, 0, 0] },
            ],
            margin: [10, 4, 0, 0],
          },
        ],
      },
      {
        text: `Generado el ${fechaLegible(entrada.generadoEn)}`,
        fontSize: 9,
        color: '#4b5563',
        margin: [0, 8, 0, 0],
      },
      {
        text: filtros.length > 0 ? `Filtros: ${filtros.join(' · ')}` : 'Sin filtros',
        fontSize: 9,
        color: '#4b5563',
        margin: [0, 2, 0, 12],
      },
    ],
  };
}

/** Documento A4 con el encabezado común y numeración de página en el pie. */
export function documento(entrada: EntradaDocumento): TDocumentDefinitions {
  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 50],
    info: { title: `PetHogar — ${entrada.titulo}`, author: 'PetHogar', creator: 'PetHogar' },
    footer: (pagina: number, total: number): Content => ({
      text: `PetHogar · Página ${pagina} de ${total}`,
      alignment: 'center',
      fontSize: 8,
      color: '#6b7280',
    }),
    content: [encabezado(entrada), ...entrada.contenido],
  };
}

/** Texto de un reporte sin filas o recortado al tope. */
export function avisoDeFilas(mostradas: number, total: number): Content {
  if (total === 0) {
    return { text: 'Sin resultados', italics: true, margin: [0, 12, 0, 0] };
  }
  return mostradas < total
    ? {
        text: `Se muestran las primeras ${mostradas} de ${total} filas. Usa los filtros para acotar el reporte.`,
        italics: true,
        fontSize: 9,
        margin: [0, 8, 0, 0],
      }
    : { text: '', margin: [0, 0, 0, 0] };
}

/** Texto de celda: nunca `undefined` y sin romper con valores nulos. */
export function celda(valor: string | number | null | undefined): string {
  return valor === null || valor === undefined || valor === '' ? '—' : String(valor);
}

export const LAYOUT_TABLA = {
  hLineColor: '#d1d5db',
  vLineColor: '#d1d5db',
  paddingTop: () => 3,
  paddingBottom: () => 3,
  fillColor: (fila: number): string | null => (fila === 0 ? '#e6f4f1' : null),
};
