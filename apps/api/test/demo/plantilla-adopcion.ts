import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
// pdfmake exporta una instancia con métodos de clase (CommonJS): `import *` los perdería.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import pdfmake = require('pdfmake');

/**
 * Herramienta de desarrollo (no es parte de la API): genera la plantilla general de PetHogar del
 * formulario de adopción como PDF imprimible y la deja en `apps/web/public/plantillas/`. Se
 * ejecuta a mano (`pnpm --filter api plantilla:adopcion`) y el PDF resultante se versiona; un
 * cambio de contenido genera `-v2` (nombre y constante `RUTA_PLANTILLA_ADOPCION` de la web).
 */
const VERSION = 'v1';
const ASSETS = resolve(__dirname, '..', '..', 'src', 'assets');
const DESTINO = resolve(__dirname, '..', '..', '..', 'web', 'public', 'plantillas');
const ARCHIVO = `formulario-adopcion-pethogar-${VERSION}.pdf`;
const COLOR_MARCA = '#0f766e';

function tabla(filas: string[][]): Content {
  return {
    layout: {
      // Una línea de escritura bajo cada fila.
      hLineWidth: (i) => (i > 0 ? 0.6 : 0),
      vLineWidth: () => 0,
      hLineColor: () => '#6b7280',
      paddingTop: () => 14,
      paddingBottom: () => 3,
    },
    table: {
      widths: [150, '*'],
      body: filas.map(([etiqueta]) => [{ text: etiqueta, bold: true }, { text: ' ' }]),
    },
  } as Content;
}

function lineas(etiqueta: string, cantidad: number): Content[] {
  return [
    { text: etiqueta, bold: true, margin: [0, 10, 0, 2] },
    ...Array.from({ length: cantidad }, () => ({
      canvas: [
        {
          type: 'line' as const,
          x1: 0,
          y1: 16,
          x2: 515,
          y2: 16,
          lineWidth: 0.6,
          lineColor: '#6b7280',
        },
      ],
      height: 20,
    })),
  ];
}

function seccion(titulo: string): Content {
  return { text: titulo, bold: true, fontSize: 13, color: COLOR_MARCA, margin: [0, 14, 0, 2] };
}

const casilla = (texto: string): Content => ({
  columns: [
    {
      canvas: [{ type: 'rect', x: 0, y: 1, w: 10, h: 10, lineWidth: 0.8, lineColor: '#374151' }],
      width: 16,
    },
    { text: texto },
  ],
  margin: [0, 4, 0, 0],
});

function definicion(logoSvg: string): TDocumentDefinitions {
  return {
    info: { title: 'Formulario de solicitud de adopción — PetHogar', author: 'PetHogar' },
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 50],
    content: [
      {
        columns: [
          { svg: logoSvg, width: 44 },
          {
            stack: [
              { text: 'PetHogar', color: COLOR_MARCA, bold: true, fontSize: 11 },
              {
                text: 'Formulario de solicitud de adopción',
                bold: true,
                fontSize: 17,
                margin: [0, 2, 0, 0],
              },
            ],
            margin: [10, 4, 0, 0],
          },
        ],
      },
      {
        text: 'Completa este formulario con letra clara, fírmalo y súbelo en PetHogar (JPG, PNG o PDF, máximo 5 MB).',
        fontSize: 9,
        color: '#4b5563',
        margin: [0, 8, 0, 0],
      },
      seccion('1. Mascota y fundación'),
      tabla([
        ['Nombre de la mascota', ''],
        ['Fundación', ''],
      ]),
      seccion('2. Datos del adoptante'),
      tabla([
        ['Nombre completo', ''],
        ['Documento de identidad', ''],
        ['Teléfono', ''],
        ['Correo electrónico', ''],
        ['Ciudad', ''],
      ]),
      seccion('3. Sobre tu solicitud'),
      ...lineas('¿Por qué quieres adoptar? (máximo 500 caracteres)', 4),
      { text: 'Tipo de vivienda', bold: true, margin: [0, 12, 0, 0] },
      { columns: [casilla('Casa'), casilla('Apartamento'), casilla('Finca')] },
      { text: '¿Tienes otras mascotas?', bold: true, margin: [0, 12, 0, 0] },
      { columns: [casilla('Sí'), casilla('No'), { text: '' }] },
      seccion('4. Declaración y firma'),
      {
        text: 'Declaro que la información es verdadera y me comprometo a cuidar de la mascota.',
        margin: [0, 2, 0, 18],
      },
      {
        columns: [
          {
            stack: [
              {
                canvas: [
                  {
                    type: 'line',
                    x1: 0,
                    y1: 0,
                    x2: 240,
                    y2: 0,
                    lineWidth: 0.6,
                    lineColor: '#6b7280',
                  },
                ],
              },
              { text: 'Firma', fontSize: 9, margin: [0, 3, 0, 0] },
            ],
          },
          {
            stack: [
              {
                canvas: [
                  {
                    type: 'line',
                    x1: 0,
                    y1: 0,
                    x2: 200,
                    y2: 0,
                    lineWidth: 0.6,
                    lineColor: '#6b7280',
                  },
                ],
              },
              { text: 'Fecha (día / mes / año)', fontSize: 9, margin: [0, 3, 0, 0] },
            ],
          },
        ],
      },
    ],
    footer: {
      text: `Plantilla general de PetHogar ${VERSION}. Tu fundación puede pedirte su propio formato.`,
      alignment: 'center',
      fontSize: 8,
      color: '#6b7280',
      margin: [40, 10, 40, 0],
    },
    defaultStyle: { font: 'Roboto', fontSize: 10 },
  };
}

async function main(): Promise<void> {
  const fuentes = {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  } as const;
  pdfmake.setFonts({
    Roboto: Object.fromEntries(
      Object.entries(fuentes).map(([estilo, archivo]) => [estilo, join(ASSETS, 'fonts', archivo)]),
    ) as Record<keyof typeof fuentes, string>,
  });
  pdfmake.setLocalAccessPolicy((ruta) => resolve(ruta).startsWith(ASSETS));
  pdfmake.setUrlAccessPolicy(() => false);

  const logoSvg = readFileSync(join(ASSETS, 'logo-pethogar.svg'), 'utf8');
  const buffer = await pdfmake.createPdf(definicion(logoSvg)).getBuffer();
  mkdirSync(DESTINO, { recursive: true });
  const salida = join(DESTINO, ARCHIVO);
  writeFileSync(salida, buffer);
  console.log(`Plantilla escrita en ${salida} (${buffer.length} bytes)`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
