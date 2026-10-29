import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
// pdfmake exporta una instancia con métodos de clase (CommonJS): `import *` los perdería.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import pdfmake = require('pdfmake');

/** Recursos versionados con el código (`src/assets`, copiados a `dist` por `nest-cli.json`). */
export const DIR_ASSETS = resolve(__dirname, '..', '..', '..', 'assets');
const FUENTES = {
  normal: 'Roboto-Regular.ttf',
  bold: 'Roboto-Medium.ttf',
  italics: 'Roboto-Italic.ttf',
  bolditalics: 'Roboto-MediumItalic.ttf',
} as const;

/**
 * Infraestructura de PDF: registra las fuentes (Roboto, con acentos y «ñ») y el logo desde disco al
 * crearse, sin red. Si falta algún archivo el arranque falla: mejor un error visible que un PDF
 * sin logo o con glifos faltantes.
 */
@Injectable()
export class PdfService {
  /** SVG del logo, listo para `{ svg, width }`. */
  readonly logoSvg: string;

  constructor() {
    const rutas = Object.values(FUENTES).map((archivo) => resolve(DIR_ASSETS, 'fonts', archivo));
    const faltante = rutas.find((ruta) => !existsSync(ruta));
    if (faltante) throw new Error(`Falta la fuente de los PDF: ${faltante}`);
    this.logoSvg = readFileSync(resolve(DIR_ASSETS, 'logo-pethogar.svg'), 'utf8');

    pdfmake.setFonts({
      Roboto: Object.fromEntries(
        Object.entries(FUENTES).map(([estilo, archivo]) => [
          estilo,
          resolve(DIR_ASSETS, 'fonts', archivo),
        ]),
      ) as Record<keyof typeof FUENTES, string>,
    });
    // Solo se puede leer del disco lo que está en `assets`; nunca una ruta que venga de un dato.
    pdfmake.setLocalAccessPolicy((ruta) => resolve(ruta).startsWith(DIR_ASSETS));
    pdfmake.setUrlAccessPolicy(() => false);
  }

  generar(definicion: TDocumentDefinitions): Promise<Buffer> {
    return pdfmake
      .createPdf({ defaultStyle: { font: 'Roboto', fontSize: 10 }, ...definicion })
      .getBuffer();
  }
}
