import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorageService } from '../../modules/storage/local-storage.service';
import {
  claveActa,
  claveComprobante,
  claveDocumentoFundacion,
  claveFormulario,
  claveFoto,
  crearEscritorDisco,
  fotosDemo,
  pdfDemo,
} from './archivos-demo';

async function listar(dir: string): Promise<string[]> {
  const entradas = await readdir(dir, { recursive: true, withFileTypes: true });
  return entradas
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name).slice(dir.length))
    .sort();
}

describe('archivos-demo', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'pethogar-demo-'));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('genera claves deterministas y válidas para el almacenamiento', async () => {
    const claves = [
      claveFoto('Luna', 'grande'),
      claveFoto('Luna', 'catalogo'),
      claveDocumentoFundacion(),
      claveFormulario('rocky'),
      claveActa('rocky'),
      claveComprobante(3),
    ];
    expect(claveFoto('Luna', 'grande')).toBe(claveFoto('Luna', 'grande'));
    expect(new Set(claves).size).toBe(claves.length);
    expect(claves[0]).toMatch(/^publico\/mascotas\/[0-9a-f-]{36}\.jpg$/);
    expect(claves[2]).toMatch(/^privado\/fundaciones\/[0-9a-f-]{36}\.pdf$/);
    expect(claves[3]).toMatch(/^privado\/solicitudes\/[0-9a-f-]{36}\.pdf$/);
    expect(claves[5]).toMatch(/^privado\/donaciones\/[0-9a-f-]{36}\.pdf$/);

    // El servicio real las acepta: lo que se escribe es legible por la API.
    const escritor = crearEscritorDisco(dir);
    for (const c of claves) await escritor.escribir(c, Buffer.from('%PDF-x'));
    const storage = new LocalStorageService({ directorio: dir, urlBase: 'http://localhost:3001' });
    for (const c of claves) await expect(storage.leer(c)).resolves.toBeDefined();
    expect(storage.urlPublica(claves[0])).toContain('/uploads/mascotas/');
  });

  it('la foto produce dos JPEG con las medidas esperadas', async () => {
    const { grande, catalogo } = await fotosDemo('Firulais');
    for (const img of [grande, catalogo]) {
      expect(img.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))).toBe(true);
    }
    const sharp = (await import('sharp')).default;
    const mg = await sharp(grande).metadata();
    const mc = await sharp(catalogo).metadata();
    expect(Math.max(mg.width ?? 0, mg.height ?? 0)).toBeLessThanOrEqual(1600);
    expect(Math.max(mc.width ?? 0, mc.height ?? 0)).toBeLessThanOrEqual(640);
    expect(grande.length).toBeGreaterThan(catalogo.length);
  });

  it('el PDF empieza por la firma %PDF-', async () => {
    const pdf = await pdfDemo('Acta de entrega', ['Mascota: Rocky']);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('escribir dos veces no duplica ni cambia archivos, y crea las carpetas', async () => {
    const escritor = crearEscritorDisco(dir);
    const entradas: [string, Buffer][] = [
      [claveFoto('Luna', 'grande'), (await fotosDemo('Luna')).grande],
      [claveDocumentoFundacion(), await pdfDemo('Doc', ['a'])],
      [claveFormulario('toby'), await pdfDemo('Form', ['a'])],
      [claveComprobante(1), await pdfDemo('Comp', ['a'])],
    ];
    for (const [c, b] of entradas) await escritor.escribir(c, b);
    const primera = await listar(dir);
    const contenido = await readFile(join(dir, claveFoto('Luna', 'grande')));
    for (const [c, b] of entradas) await escritor.escribir(c, b);
    expect(await listar(dir)).toEqual(primera);
    expect(primera).toHaveLength(4);
    expect(await readdir(join(dir, 'publico'))).toEqual(['mascotas']);
    expect((await readdir(join(dir, 'privado'))).sort()).toEqual([
      'donaciones',
      'fundaciones',
      'solicitudes',
    ]);
    expect(await readFile(join(dir, claveFoto('Luna', 'grande')))).toEqual(contenido);
  });

  it('no sobrescribe un archivo existente', async () => {
    const c = claveDocumentoFundacion();
    await mkdir(join(dir, 'privado', 'fundaciones'), { recursive: true });
    await writeFile(join(dir, c), 'cambio manual');
    await crearEscritorDisco(dir).escribir(c, Buffer.from('nuevo'));
    expect(await readFile(join(dir, c), 'utf8')).toBe('cambio manual');
  });
});
