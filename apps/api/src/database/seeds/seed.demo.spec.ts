import type { EntityManager } from 'typeorm';
import type { SeedConfig } from './seed.config';
import {
  ADOPCIONES_DEMO,
  DONACIONES_DEMO,
  MASCOTAS_ADOPTADAS_DEMO,
  SEGUIMIENTOS_DEMO,
  SOLICITUDES_DEMO,
} from './seed.demo.data';
import { MASCOTAS_DEMO, sembrarDemo } from './seed.demo';
import type { ArchivosDemo } from './archivos-demo';

const FORMA_CLAVE =
  /^(publico|privado)\/(mascotas|fundaciones|solicitudes|donaciones)\/[0-9a-f-]{36}\.(jpg|pdf)$/;
const ECONOMICAS = DONACIONES_DEMO.filter((d) => d.tipo === 'economica').length;

function escritorFalso() {
  const escritos = new Map<string, Buffer>();
  const archivos: ArchivosDemo = {
    escribir: (clave, contenido) => {
      escritos.set(clave, contenido);
      return Promise.resolve();
    },
  };
  return { archivos, escritos };
}

/** Claves de almacenamiento que el seed intenta guardar en filas (parámetros de los INSERT). */
function clavesInsertadas(query: jest.Mock<Promise<unknown[]>, [string, unknown[]?]>): string[] {
  return query.mock.calls
    .filter(([sql]) => /^\s*INSERT/.test(sql))
    .flatMap(([, params]) => (params ?? []).filter((p): p is string => typeof p === 'string'))
    .filter((p) => /^(publico|privado)\//.test(p) || p.startsWith('/uploads/'));
}

const CONFIG: SeedConfig = {
  adminEmail: 'a@b.co',
  adminPassword: 'una-clave-larga-1',
  adminTelefono: '1',
  demo: true,
  demoPassword: 'demo-clave-larga',
};

function managerSimulado(existente: boolean) {
  const query = jest.fn<Promise<unknown[]>, [string, unknown[]?]>((sql) => {
    if (sql.includes('make_interval'))
      return Promise.resolve([{ ts: new Date('2026-01-01T12:00:00Z'), dia: '2026-01-01' }]);
    if (sql.includes('SELECT "id", "nombre" FROM "mascota"'))
      return Promise.resolve(
        [...MASCOTAS_DEMO, ...MASCOTAS_ADOPTADAS_DEMO].map((m, i) => ({
          id: i + 1,
          nombre: m.nombre,
        })),
      );
    if (sql.includes('SELECT 1 FROM "solicitud_adopcion"'))
      return Promise.resolve(existente ? [{}] : []);
    if (sql.includes('SELECT "id" FROM "usuario"'))
      return Promise.resolve(existente ? [{ id: 5 }] : []);
    if (sql.includes('RETURNING')) return Promise.resolve([{ id: 7 }]);
    if (sql.includes('SELECT "id" FROM "fundacion"')) return Promise.resolve([{ id: 9 }]);
    if (sql.includes('SELECT 1 FROM "mascota"')) return Promise.resolve(existente ? [{}] : []);
    return Promise.resolve([]);
  });
  return { manager: { query } as unknown as EntityManager, query };
}

describe('sembrarDemo', () => {
  it('crea 7 mascotas (4 disponibles y 3 adoptadas) con foto principal cuando no existen', async () => {
    const { manager, query } = managerSimulado(false);
    await sembrarDemo(manager, CONFIG, undefined, escritorFalso().archivos);
    const sqls = query.mock.calls.map((c) => c[0]);
    expect(MASCOTAS_DEMO).toHaveLength(4);
    expect(MASCOTAS_ADOPTADAS_DEMO).toHaveLength(3);
    expect(sqls.filter((s) => s.includes('INTO "mascota"'))).toHaveLength(7);
    expect(sqls.filter((s) => s.includes('INTO "foto_mascota"'))).toHaveLength(7);
    expect(sqls.some((s) => s.includes("'aprobada'"))).toBe(true);
    expect(
      sqls.filter((s) => s.includes('INTO "foto_mascota"') && s.includes('"url_catalogo"')),
    ).toHaveLength(7);
  });

  it('siembra la actividad completa de la fundación demo', async () => {
    const { manager, query } = managerSimulado(false);
    await sembrarDemo(manager, CONFIG, undefined, escritorFalso().archivos);
    const sqls = query.mock.calls.map((c) => c[0]);
    const cuenta = (tabla: string) => sqls.filter((s) => s.includes(`INTO "${tabla}"`)).length;
    expect(cuenta('solicitud_adopcion')).toBe(SOLICITUDES_DEMO.length);
    expect(cuenta('adopcion')).toBe(ADOPCIONES_DEMO.length);
    expect(cuenta('seguimiento')).toBe(SEGUIMIENTOS_DEMO.length);
    expect(cuenta('donacion')).toBe(DONACIONES_DEMO.length);
    expect(cuenta('adoptante')).toBe(1);
    expect(cuenta('notificacion')).toBeGreaterThan(0);
    expect(
      sqls.filter((s) => s.includes('INTO "notificacion"')).every((s) => s.includes('ON CONFLICT')),
    ).toBe(true);
  });

  it('no inserta mascotas ni usuario si ya existen', async () => {
    const { manager, query } = managerSimulado(true);
    await sembrarDemo(manager, CONFIG, undefined, escritorFalso().archivos);
    const sqls = query.mock.calls.map((c) => c[0]);
    expect(sqls.some((s) => s.includes('INTO "mascota"'))).toBe(false);
    expect(sqls.some((s) => s.includes('INTO "usuario"'))).toBe(false);
    expect(sqls.some((s) => s.includes('INTO "solicitud_adopcion"'))).toBe(false);
    expect(sqls.some((s) => s.includes('INTO "notificacion"'))).toBe(false);
  });

  it('usa claves de almacenamiento válidas y escribe las fotos y los PDF esperados', async () => {
    const { manager, query } = managerSimulado(false);
    const { archivos, escritos } = escritorFalso();
    await sembrarDemo(manager, CONFIG, undefined, archivos);

    const claves = clavesInsertadas(query);
    expect(claves.length).toBeGreaterThan(0);
    expect(claves.some((c) => c.startsWith('/uploads/demo/'))).toBe(false);
    for (const c of claves) expect(c).toMatch(FORMA_CLAVE);
    // Todo lo referenciado en filas existe entre los archivos escritos.
    for (const c of claves) expect(escritos.has(c)).toBe(true);

    const fotos = query.mock.calls.filter(([sql]) => sql.includes('INTO "foto_mascota"'));
    for (const [, params] of fotos) {
      const [, url, urlCatalogo] = params as string[];
      expect(url).toMatch(/^publico\/mascotas\//);
      expect(urlCatalogo).toMatch(/^publico\/mascotas\//);
      expect(url).not.toBe(urlCatalogo);
    }
    const jpg = [...escritos.keys()].filter((c) => c.endsWith('.jpg'));
    const pdf = [...escritos.keys()].filter((c) => c.endsWith('.pdf'));
    expect(jpg).toHaveLength(7 * 2);
    expect(pdf).toHaveLength(1 + SOLICITUDES_DEMO.length + ADOPCIONES_DEMO.length + ECONOMICAS);
  });

  it('con datos existentes no inserta filas pero sí asegura archivos y repara rutas viejas', async () => {
    const { manager, query } = managerSimulado(true);
    const { archivos, escritos } = escritorFalso();
    await sembrarDemo(manager, CONFIG, undefined, archivos);
    expect(escritos.size).toBeGreaterThan(0);
    const sqls = query.mock.calls.map((c) => c[0]);
    expect(sqls.some((s) => s.includes('INTO "foto_mascota"'))).toBe(false);
    const updates = query.mock.calls.filter(([sql]) => sql.startsWith('UPDATE'));
    expect(updates.length).toBeGreaterThan(0);
    for (const [, params] of updates) {
      expect((params as string[])[0]).toMatch(/^\/uploads\/demo\//);
      expect((params as string[])[1]).toMatch(FORMA_CLAVE);
    }
  });

  it('ejecutarlo dos veces no cambia el conjunto de archivos ni de claves', async () => {
    const a = managerSimulado(false);
    const b = managerSimulado(false);
    const primera = escritorFalso();
    const segunda = escritorFalso();
    await sembrarDemo(a.manager, CONFIG, undefined, primera.archivos);
    await sembrarDemo(b.manager, CONFIG, undefined, segunda.archivos);
    expect([...segunda.escritos.keys()].sort()).toEqual([...primera.escritos.keys()].sort());
    expect(clavesInsertadas(b.query)).toEqual(clavesInsertadas(a.query));
  });

  it('exige la contraseña demo', async () => {
    const { manager } = managerSimulado(false);
    await expect(
      sembrarDemo(
        manager,
        { ...CONFIG, demoPassword: undefined },
        undefined,
        escritorFalso().archivos,
      ),
    ).rejects.toThrow(/SEED_DEMO_PASSWORD/);
  });
});
