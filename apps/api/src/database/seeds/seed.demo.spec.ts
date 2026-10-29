import type { EntityManager } from 'typeorm';
import type { SeedConfig } from './seed.config';
import { MASCOTAS_DEMO, sembrarDemo } from './seed.demo';

const CONFIG: SeedConfig = {
  adminEmail: 'a@b.co',
  adminPassword: 'una-clave-larga-1',
  adminTelefono: '1',
  demo: true,
  demoPassword: 'demo-clave-larga',
};

function managerSimulado(existente: boolean) {
  const query = jest.fn<Promise<unknown[]>, [string, unknown[]?]>((sql) => {
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
  it('crea 4 mascotas con foto principal cuando no existen', async () => {
    const { manager, query } = managerSimulado(false);
    await sembrarDemo(manager, CONFIG);
    const sqls = query.mock.calls.map((c) => c[0]);
    expect(MASCOTAS_DEMO).toHaveLength(4);
    expect(sqls.filter((s) => s.includes('INTO "mascota"'))).toHaveLength(4);
    expect(sqls.filter((s) => s.includes('INTO "foto_mascota"'))).toHaveLength(4);
    expect(sqls.some((s) => s.includes("'aprobada'"))).toBe(true);
  });

  it('no inserta mascotas ni usuario si ya existen', async () => {
    const { manager, query } = managerSimulado(true);
    await sembrarDemo(manager, CONFIG);
    const sqls = query.mock.calls.map((c) => c[0]);
    expect(sqls.some((s) => s.includes('INTO "mascota"'))).toBe(false);
    expect(sqls.some((s) => s.includes('INTO "usuario"'))).toBe(false);
  });

  it('exige la contraseña demo', async () => {
    const { manager } = managerSimulado(false);
    await expect(sembrarDemo(manager, { ...CONFIG, demoPassword: undefined })).rejects.toThrow(
      /SEED_DEMO_PASSWORD/,
    );
  });
});
