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
    await sembrarDemo(manager, CONFIG);
    const sqls = query.mock.calls.map((c) => c[0]);
    expect(MASCOTAS_DEMO).toHaveLength(4);
    expect(MASCOTAS_ADOPTADAS_DEMO).toHaveLength(3);
    expect(sqls.filter((s) => s.includes('INTO "mascota"'))).toHaveLength(7);
    expect(sqls.filter((s) => s.includes('INTO "foto_mascota"'))).toHaveLength(7);
    expect(sqls.some((s) => s.includes("'aprobada'"))).toBe(true);
    expect(sqls.filter((s) => s.includes('"url_catalogo"'))).toHaveLength(7);
  });

  it('siembra la actividad completa de la fundación demo', async () => {
    const { manager, query } = managerSimulado(false);
    await sembrarDemo(manager, CONFIG);
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
    await sembrarDemo(manager, CONFIG);
    const sqls = query.mock.calls.map((c) => c[0]);
    expect(sqls.some((s) => s.includes('INTO "mascota"'))).toBe(false);
    expect(sqls.some((s) => s.includes('INTO "usuario"'))).toBe(false);
    expect(sqls.some((s) => s.includes('INTO "solicitud_adopcion"'))).toBe(false);
    expect(sqls.some((s) => s.includes('INTO "notificacion"'))).toBe(false);
  });

  it('exige la contraseña demo', async () => {
    const { manager } = managerSimulado(false);
    await expect(sembrarDemo(manager, { ...CONFIG, demoPassword: undefined })).rejects.toThrow(
      /SEED_DEMO_PASSWORD/,
    );
  });
});
