import { BadRequestException, Injectable } from '@nestjs/common';
import sharp, { type Sharp } from 'sharp';

export const LADO_CATALOGO_PX = 640;
export const LADO_GRANDE_PX = 1600;
export const CALIDAD_JPEG = 80;
/** Tope de píxeles de la entrada: protege la memoria frente a «bombas de descompresión». */
export const MAX_PIXELES_ENTRADA = 40_000_000;

export interface ImagenProcesada {
  catalogo: Buffer;
  grande: Buffer;
}

export interface LimitesImagen {
  maxPixeles: number;
}

const MENSAJE_DANADA = 'La imagen está dañada o no se puede procesar';
const MENSAJE_PIXELES = 'La imagen tiene demasiados píxeles; reduce su tamaño e inténtalo de nuevo';

/**
 * Único lugar que importa `sharp`. Genera la versión de catálogo (640 px) y la grande (1600 px)
 * como JPEG: corrige la orientación según EXIF, aplana la transparencia de un PNG sobre blanco y
 * descarta todos los metadatos (EXIF y GPS incluidos). Nunca amplía una imagen pequeña.
 */
@Injectable()
export class ProcesadorImagenService {
  async procesar(
    entrada: Buffer,
    limites: LimitesImagen = { maxPixeles: MAX_PIXELES_ENTRADA },
  ): Promise<ImagenProcesada> {
    try {
      const base = sharp(entrada, {
        limitInputPixels: limites.maxPixeles,
        failOn: 'error',
      })
        .rotate()
        .flatten({ background: '#ffffff' });
      const [catalogo, grande] = await Promise.all([
        derivar(base, LADO_CATALOGO_PX),
        derivar(base, LADO_GRANDE_PX),
      ]);
      return { catalogo, grande };
    } catch (error) {
      throw new BadRequestException(
        /pixel limit/i.test(error instanceof Error ? error.message : '')
          ? MENSAJE_PIXELES
          : MENSAJE_DANADA,
      );
    }
  }
}

function derivar(base: Sharp, lado: number): Promise<Buffer> {
  return base
    .clone()
    .resize({ width: lado, height: lado, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: CALIDAD_JPEG })
    .toBuffer();
}
