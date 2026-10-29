import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { BadRequestException, Logger, PayloadTooLargeException } from '@nestjs/common';
import { LocalStorageService } from './local-storage.service';
import { MAX_BYTES, type CarpetaArchivo } from './storage.constants';
import { detectarTipo } from './tipo-archivo';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16),
]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
const PDF = Buffer.from('%PDF-1.7\n%%EOF');
const EXE = Buffer.from('MZ\x90\x00 programa', 'latin1');

async function listarTodo(dir: string): Promise<string[]> {
  const entradas = await readdir(dir, { recursive: true });
  return entradas;
}

describe('detectarTipo', () => {
  it('reconoce JPG, PNG y PDF por su firma', () => {
    expect(detectarTipo(JPG)).toBe('image/jpeg');
    expect(detectarTipo(PNG)).toBe('image/png');
    expect(detectarTipo(PDF)).toBe('application/pdf');
  });

  it('devuelve null para contenido desconocido o demasiado corto', () => {
    expect(detectarTipo(EXE)).toBeNull();
    expect(detectarTipo(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(detectarTipo(Buffer.alloc(0))).toBeNull();
  });
});

describe('LocalStorageService', () => {
  let raiz: string;
  let servicio: LocalStorageService;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    raiz = await mkdtemp(path.join(tmpdir(), 'pethogar-storage-'));
    servicio = new LocalStorageService({ directorio: raiz, urlBase: 'http://api.test/' });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await rm(raiz, { recursive: true, force: true });
  });

  it('guarda una imagen pública con nombre aleatorio y extensión según el contenido', async () => {
    const r = await servicio.guardar(
      { buffer: PNG, nombreOriginal: '../../etc/passwd.exe' },
      { categoria: 'imagen', carpeta: 'mascotas' },
    );
    expect(r.clave).toMatch(/^publico\/mascotas\/[0-9a-f-]{36}\.png$/);
    expect(r.clave).not.toContain('passwd');
    expect(r).toMatchObject({ visibilidad: 'publico', tipo: 'image/png', tamano: PNG.length });
    expect((await readFile(path.join(raiz, r.clave))).equals(PNG)).toBe(true);
    expect(servicio.urlPublica(r.clave)).toBe(
      `http://api.test/uploads/mascotas/${r.clave.split('/')[2]}`,
    );
  });

  it('genera nombres distintos para el mismo contenido', async () => {
    const op = { categoria: 'imagen', carpeta: 'mascotas' } as const;
    const a = await servicio.guardar({ buffer: JPG }, op);
    const b = await servicio.guardar({ buffer: JPG }, op);
    expect(a.clave).not.toBe(b.clave);
  });

  it('acepta PDF como documento privado y no ofrece URL pública', async () => {
    const r = await servicio.guardar(
      { buffer: PDF },
      { categoria: 'documento', carpeta: 'fundaciones' },
    );
    expect(r.clave).toMatch(/^privado\/fundaciones\/.+\.pdf$/);
    expect(() => servicio.urlPublica(r.clave)).toThrow(BadRequestException);
  });

  it('rechaza un PDF como imagen y un ejecutable con extensión de imagen, sin escribir en disco', async () => {
    await expect(
      servicio.guardar({ buffer: PDF }, { categoria: 'imagen', carpeta: 'mascotas' }),
    ).rejects.toThrow('Solo se permiten imágenes JPG o PNG');
    await expect(
      servicio.guardar(
        { buffer: EXE, nombreOriginal: 'foto.jpg' },
        { categoria: 'documento', carpeta: 'donaciones' },
      ),
    ).rejects.toThrow('Solo se permiten archivos JPG, PNG o PDF');
    expect(await listarTodo(raiz)).toEqual([]);
  });

  it('rechaza archivos vacíos y mayores de 5 MB, aceptando exactamente 5 MB', async () => {
    const op = { categoria: 'imagen', carpeta: 'mascotas' } as const;
    await expect(servicio.guardar({ buffer: Buffer.alloc(0) }, op)).rejects.toThrow('vacío');
    const grande = Buffer.concat([JPG, Buffer.alloc(MAX_BYTES + 1 - JPG.length)]);
    await expect(servicio.guardar({ buffer: grande }, op)).rejects.toThrow(
      PayloadTooLargeException,
    );
    expect(await listarTodo(raiz)).toEqual([]);
    const justo = Buffer.concat([JPG, Buffer.alloc(MAX_BYTES - JPG.length)]);
    await expect(servicio.guardar({ buffer: justo }, op)).resolves.toMatchObject({
      tamano: MAX_BYTES,
    });
  });

  it('rechaza carpetas fuera de la lista (path traversal)', async () => {
    const carpeta = '../../fuera' as unknown as CarpetaArchivo;
    await expect(
      servicio.guardar({ buffer: PNG }, { categoria: 'imagen', carpeta }),
    ).rejects.toThrow('carpeta de destino');
    expect(await listarTodo(raiz)).toEqual([]);
  });

  it.each([
    '../secreto.png',
    'publico/../../secreto.png',
    '/etc/passwd',
    'publico/mascotas/../../../x.png',
    'publico\\mascotas\\x.png',
    'publico/mascotas/a\0b.png',
    'publico/otra/00000000-0000-0000-0000-000000000000.png',
    'privado/mascotas/00000000-0000-0000-0000-000000000000.png',
    'publico/mascotas/nombre-libre.png',
  ])('rechaza la clave no válida %j en eliminar y urlPublica', async (clave) => {
    await expect(servicio.eliminar(clave)).rejects.toThrow('La clave del archivo no es válida');
    expect(() => servicio.urlPublica(clave)).toThrow('La clave del archivo no es válida');
  });

  it('elimina un archivo y es idempotente si no existe', async () => {
    const r = await servicio.guardar({ buffer: PNG }, { categoria: 'imagen', carpeta: 'mascotas' });
    await servicio.eliminar(r.clave);
    expect(existsSync(path.join(raiz, r.clave))).toBe(false);
    await expect(servicio.eliminar(r.clave)).resolves.toBeUndefined();
    await expect(
      servicio.eliminar(`publico/mascotas/${randomUUID()}.png`),
    ).resolves.toBeUndefined();
  });

  it('rechaza archivos existentes cuyo nombre no generó el servicio', async () => {
    await mkdir(path.join(raiz, 'publico'), { recursive: true });
    await writeFile(path.join(raiz, 'publico', 'x.txt'), 'x');
    await expect(servicio.eliminar('publico/x.txt')).rejects.toThrow(BadRequestException);
    expect(existsSync(path.join(raiz, 'publico', 'x.txt'))).toBe(true);
  });
});
