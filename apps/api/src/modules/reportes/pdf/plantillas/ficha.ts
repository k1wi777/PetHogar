import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { MascotaFicha } from '../../../mascotas/catalogo/catalogo.types';
import type { FotoFicha } from '../../../mascotas/catalogo/foto-ficha.service';
import { celda, documento, LAYOUT_TABLA } from '../documento';

export interface DatosFicha {
  ficha: MascotaFicha;
  foto: FotoFicha | null;
  generadoEn: Date;
  logoSvg: string;
}

const TIPOS_HISTORIAL: Record<string, string> = {
  vacuna: 'Vacuna',
  desparasitacion: 'Desparasitación',
  cirugia: 'Cirugía',
  consulta: 'Consulta',
};

/** «2 años y 3 meses», «8 meses», «1 mes». */
export function edadLegible(meses: number): string {
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  const parteAnios = anios > 0 ? `${anios} ${anios === 1 ? 'año' : 'años'}` : '';
  const parteMeses = resto > 0 || anios === 0 ? `${resto} ${resto === 1 ? 'mes' : 'meses'}` : '';
  return [parteAnios, parteMeses].filter(Boolean).join(' y ');
}

const siNo = (valor: boolean): string => (valor ? 'Sí' : 'No');
const capitalizar = (texto: string): string => texto.charAt(0).toUpperCase() + texto.slice(1);

/**
 * Ficha pública: solo los datos que ya expone el catálogo (sin NIT, documento, correo, teléfono
 * ni dirección de la fundación). Función pura `datos → definición`.
 */
export function plantillaFicha(datos: DatosFicha): TDocumentDefinitions {
  const { ficha } = datos;
  const fila = (etiqueta: string, valor: string): Content[] => [
    { text: etiqueta, bold: true },
    { text: celda(valor) },
  ];
  const datosGenerales: Content = {
    layout: 'noBorders',
    table: {
      widths: [90, '*'],
      body: [
        fila('Especie', capitalizar(ficha.especie)),
        fila('Raza', ficha.raza),
        fila('Sexo', capitalizar(ficha.sexo)),
        fila('Edad', edadLegible(ficha.edadMeses)),
        fila('Tamaño', capitalizar(ficha.tamano)),
        fila('Color', celda(ficha.color)),
        fila('Esterilizado', siNo(ficha.esterilizado)),
        fila('Vacunado', siNo(ficha.vacunado)),
        fila('Estado de salud', ficha.estadoSalud),
      ],
    },
  };
  const foto: Content[] = datos.foto
    ? [
        {
          image: `data:${datos.foto.tipo};base64,${datos.foto.buffer.toString('base64')}`,
          fit: [170, 170],
        },
      ]
    : [{ text: 'Sin foto', italics: true, color: '#6b7280' }];

  const historial: Content =
    ficha.historial.length === 0
      ? { text: 'Sin eventos registrados', italics: true }
      : {
          layout: LAYOUT_TABLA,
          table: {
            headerRows: 1,
            widths: [60, 80, '*', 90],
            body: [
              ['Fecha', 'Tipo', 'Descripción', 'Veterinario'].map((t) => ({ text: t, bold: true })),
              ...ficha.historial.map((h) => [
                h.fecha,
                TIPOS_HISTORIAL[h.tipo] ?? h.tipo,
                h.descripcion,
                celda(h.veterinario),
              ]),
            ],
          },
        };

  return documento({
    titulo: `Ficha de ${ficha.nombre}`,
    filtros: [],
    generadoEn: datos.generadoEn,
    logoSvg: datos.logoSvg,
    contenido: [
      {
        columns: [
          { width: 180, stack: foto },
          { width: '*', stack: [datosGenerales] },
        ],
        columnGap: 12,
      },
      { text: 'Descripción', bold: true, fontSize: 12, margin: [0, 14, 0, 4] },
      { text: celda(ficha.descripcion) },
      { text: 'Historial médico', bold: true, fontSize: 12, margin: [0, 14, 0, 4] },
      historial,
      { text: 'Fundación', bold: true, fontSize: 12, margin: [0, 14, 0, 4] },
      { text: `${ficha.fundacion.nombre} · ${ficha.fundacion.ciudad}` },
      ...(ficha.fundacion.descripcion
        ? [
            {
              text: ficha.fundacion.descripcion,
              fontSize: 9,
              margin: [0, 2, 0, 0] as [number, number, number, number],
            },
          ]
        : []),
    ],
  });
}
