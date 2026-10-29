import * as bcrypt from 'bcryptjs';
import type { EntityManager } from 'typeorm';
import { RAZAS_POR_ESPECIE } from './catalogos.data';
import { sembrarBase } from './seed';
import type { SeedConfig } from './seed.config';

const CONFIG: SeedConfig = {
  adminEmail: 'admin@pethogar.local',
  adminPassword: 'una-clave-larga-1',
  adminTelefono: '3000000000',
  demo: false,
};

function managerSimulado(adminExiste: boolean) {
  const query = jest.fn<Promise<unknown[]>, [string, unknown[]?]>((sql) => {
    if (sql.includes('SELECT "id" FROM "usuario"')) {
      return Promise.resolve(adminExiste ? [{ id: 1 }] : []);
    }
    return Promise.resolve([]);
  });
  return { manager: { query } as unknown as EntityManager, query };
}

describe('sembrarBase', () => {
  it('inserta roles, especies y razas con ON CONFLICT DO NOTHING', async () => {
    const { manager, query } = managerSimulado(true);
    await sembrarBase(manager, CONFIG);
    const sqls = query.mock.calls.map((c) => c[0]);
    const totalRazas = Object.values(RAZAS_POR_ESPECIE).flat().length;
    expect(sqls.filter((s) => s.includes('INTO "rol"'))).toHaveLength(3);
    expect(sqls.filter((s) => s.includes('INTO "especie"'))).toHaveLength(2);
    expect(sqls.filter((s) => s.includes('INTO "raza"'))).toHaveLength(totalRazas);
    expect(
      sqls
        .filter((s) => s.startsWith('INSERT') || s.includes('INSERT INTO'))
        .every((s) => s.includes('ON CONFLICT')),
    ).toBe(true);
  });

  it('guarda el administrador solo como hash bcrypt', async () => {
    const { manager, query } = managerSimulado(false);
    await sembrarBase(manager, CONFIG);
    const insercion = query.mock.calls.find((c) => c[0].includes('INTO "usuario"'))!;
    const [email, hash, telefono] = insercion[1] as string[];
    expect(email).toBe(CONFIG.adminEmail);
    expect(telefono).toBe('3000000000');
    expect(hash).not.toBe(CONFIG.adminPassword);
    expect(hash).toMatch(/^\$2[ab]\$12\$/);
    expect(await bcrypt.compare(CONFIG.adminPassword, hash)).toBe(true);
  });

  it('no modifica un administrador existente', async () => {
    const { manager, query } = managerSimulado(true);
    await sembrarBase(manager, CONFIG);
    const sqls = query.mock.calls.map((c) => c[0]);
    expect(sqls.some((s) => s.includes('INTO "usuario"'))).toBe(false);
    expect(sqls.some((s) => s.includes('UPDATE'))).toBe(false);
  });
});
