import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { ProcesadorImagenService } from '../../modules/mascotas/fotos/procesador-imagen.service';
import { PdfService } from '../../modules/reportes/pdf/pdf.service';
import {
  VISIBILIDAD_POR_CARPETA,
  type CarpetaArchivo,
} from '../../modules/storage/storage.constants';

/** Destino de los archivos del demo; el real escribe en disco y las pruebas inyectan uno falso. */
export interface ArchivosDemo {
  escribir(clave: string, contenido: Buffer): Promise<void>;
}

const DIR_IMAGENES = join(__dirname, 'assets', 'mascotas');

/**
 * UUID derivado del nombre lógico: repetir el seed produce las mismas claves y nunca duplica
 * archivos. Tiene la forma que exige `LocalStorageService` (`[0-9a-f-]{36}`).
 */
function uuidDeterminista(nombreLogico: string): string {
  const h = createHash('sha1').update(`pethogar-demo:${nombreLogico}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function clave(carpeta: CarpetaArchivo, nombreLogico: string, extension: 'jpg' | 'pdf'): string {
  return `${VISIBILIDAD_POR_CARPETA[carpeta]}/${carpeta}/${uuidDeterminista(nombreLogico)}.${extension}`;
}

export const claveFoto = (mascota: string, version: 'grande' | 'catalogo'): string =>
  clave('mascotas', `foto-${mascota.toLowerCase()}-${version}`, 'jpg');
export const claveDocumentoFundacion = (): string =>
  clave('fundaciones', 'documento-fundacion', 'pdf');
export const claveFormulario = (solicitud: string): string =>
  clave('solicitudes', `formulario-${solicitud}`, 'pdf');
export const claveActa = (solicitud: string): string =>
  clave('solicitudes', `acta-${solicitud}`, 'pdf');
export const claveComprobante = (numero: number): string =>
  clave('donaciones', `comprobante-${numero}`, 'pdf');

/** Escribe en `<directorio>/<clave>` solo si el archivo no existe: no pisa cambios manuales. */
export function crearEscritorDisco(directorio: string): ArchivosDemo {
  const raiz = resolve(directorio);
  return {
    async escribir(claveArchivo, contenido) {
      const destino = resolve(raiz, claveArchivo);
      await mkdir(dirname(destino), { recursive: true });
      try {
        await writeFile(destino, contenido, { flag: 'wx' });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
    },
  };
}

/** Versión grande (≤1600 px) y de catálogo (≤640 px) de la foto versionada de la mascota. */
export async function fotosDemo(mascota: string): Promise<{ grande: Buffer; catalogo: Buffer }> {
  const original = await readFile(join(DIR_IMAGENES, `${mascota.toLowerCase()}.jpg`));
  return new ProcesadorImagenService().procesar(original);
}

let pdf: PdfService | undefined;

/** PDF de una página con la leyenda de que es de demostración. */
export function pdfDemo(titulo: string, lineas: string[]): Promise<Buffer> {
  pdf ??= new PdfService();
  return pdf.generar({
    content: [
      { svg: pdf.logoSvg, width: 40, margin: [0, 0, 0, 12] },
      { text: `Documento de demostración — ${titulo}`, fontSize: 16, bold: true },
      { text: lineas.join('\n'), margin: [0, 12, 0, 12] },
      { text: 'Generado por el seed demo; no es un documento real.', italics: true },
    ],
  });
}
