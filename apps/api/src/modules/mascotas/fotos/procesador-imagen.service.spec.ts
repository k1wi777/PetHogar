import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { ProcesadorImagenService } from './procesador-imagen.service';

// Usa `sharp` real con imágenes diminutas generadas en memoria: sin disco, red ni base de datos.
const servicio = new ProcesadorImagenService();

const color = { r: 200, g: 30, b: 30 };
const crear = (width: number, height: number, canales: 3 | 4 = 3) =>
  sharp({
    create: {
      width,
      height,
      channels: canales,
      background: canales === 4 ? { ...color, alpha: 0 } : color,
    },
  });

const esJpeg = (b: Buffer): boolean => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

describe('ProcesadorImagenService', () => {
  it('genera dos JPEG: catálogo (máx. 640 px) y grande (máx. 1600 px)', async () => {
    const entrada = await crear(2000, 1000).png().toBuffer();
    const { catalogo, grande } = await servicio.procesar(entrada);
    expect(esJpeg(catalogo) && esJpeg(grande)).toBe(true);
    expect(await sharp(catalogo).metadata()).toMatchObject({
      format: 'jpeg',
      width: 640,
      height: 320,
    });
    expect(await sharp(grande).metadata()).toMatchObject({
      format: 'jpeg',
      width: 1600,
      height: 800,
    });
  });

  it('no amplía una imagen pequeña', async () => {
    const entrada = await crear(2, 2).jpeg().toBuffer();
    const { catalogo, grande } = await servicio.procesar(entrada);
    expect(await sharp(catalogo).metadata()).toMatchObject({ width: 2, height: 2 });
    expect(await sharp(grande).metadata()).toMatchObject({ width: 2, height: 2 });
  });

  it('aplana la transparencia de un PNG sobre blanco', async () => {
    const entrada = await crear(2, 2, 4).png().toBuffer();
    const { catalogo } = await servicio.procesar(entrada);
    const { data } = await sharp(catalogo).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(245);
    expect(data[1]).toBeGreaterThan(245);
    expect(data[2]).toBeGreaterThan(245);
  });

  it('corrige la orientación EXIF y elimina los metadatos', async () => {
    const entrada = await crear(4, 2)
      .withExif({ IFD0: { Copyright: 'secreto-gps' } })
      .jpeg()
      .toBuffer();
    const rotada = await sharp(entrada).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    expect((await sharp(rotada).metadata()).orientation).toBe(6);

    const { catalogo, grande } = await servicio.procesar(rotada);
    for (const salida of [catalogo, grande]) {
      const meta = await sharp(salida).metadata();
      expect([meta.width, meta.height]).toEqual([2, 4]);
      expect(meta.exif).toBeUndefined();
      expect(meta.orientation).toBeUndefined();
      expect(salida.includes(Buffer.from('secreto-gps'))).toBe(false);
    }
  });

  it('rechaza con 400 en español un archivo con firma válida pero ilegible', async () => {
    const corrupto = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]);
    const error = await servicio.procesar(corrupto).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as Error).message).toBe('La imagen está dañada o no se puede procesar');
  });

  it('rechaza una imagen que supera el tope de píxeles', async () => {
    const entrada = await crear(20, 20).png().toBuffer();
    const error = await servicio.procesar(entrada, { maxPixeles: 100 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as Error).message).toContain('demasiados píxeles');
  });
});
