import * as bcrypt from 'bcryptjs';
import type { DataSource } from 'typeorm';
import { RAZAS_POR_ESPECIE } from '../../src/database/seeds/catalogos.data';
import { sembrarBase } from '../../src/database/seeds/seed';
import type { SeedConfig } from '../../src/database/seeds/seed.config';
import { sembrarDemo } from '../../src/database/seeds/seed.demo';
import { borrarBaseDePrueba, contar, crearDataSource, recrearBaseDePrueba } from './db-helper';

const CONFIG: SeedConfig = {
  adminEmail: 'admin@pethogar.local',
  adminPassword: 'una-clave-larga-1',
  adminTelefono: '3000000000',
  demo: true,
  demoPassword: 'demo-clave-larga',
};

describe('seed (V8)', () => {
  let ds: DataSource;

  const ejecutar = (demo: boolean, config: SeedConfig = CONFIG) =>
    ds.transaction(async (manager) => {
      await sembrarBase(manager, config);
      if (demo) await sembrarDemo(manager, config);
    });

  beforeAll(async () => {
    await recrearBaseDePrueba();
    ds = await crearDataSource();
    await ds.runMigrations();
  });

  afterAll(async () => {
    await ds.destroy();
    await borrarBaseDePrueba();
  });

  it('es idempotente y guarda el administrador con hash bcrypt', async () => {
    await ejecutar(false);
    await ejecutar(false, { ...CONFIG, adminPassword: 'otra-clave-distinta-9' });

    const razas = Object.values(RAZAS_POR_ESPECIE).flat().length;
    expect(await contar(ds, 'SELECT count(*) AS n FROM rol')).toBe(3);
    expect(await contar(ds, 'SELECT count(*) AS n FROM especie')).toBe(2);
    expect(await contar(ds, 'SELECT count(*) AS n FROM raza')).toBe(razas);
    expect(await contar(ds, 'SELECT count(*) AS n FROM usuario')).toBe(1);

    const [admin] = await ds.query(
      `SELECT u.contrasena, u.activo, u.email_verificado, r.nombre AS rol
       FROM usuario u JOIN rol r ON r.id = u.rol_id`,
    );
    expect(admin.rol).toBe('administrador');
    expect(admin.activo).toBe(true);
    expect(admin.email_verificado).toBe(true);
    expect(admin.contrasena).not.toBe(CONFIG.adminPassword);
    // La segunda ejecución con otra contraseña no debe haber pisado la original.
    expect(await bcrypt.compare(CONFIG.adminPassword, admin.contrasena)).toBe(true);
  });

  it('--demo dos veces deja 1 fundación aprobada y 4 mascotas con foto principal', async () => {
    await ejecutar(true);
    await ejecutar(true);

    expect(
      await contar(ds, `SELECT count(*) AS n FROM fundacion WHERE estado_validacion = 'aprobada'`),
    ).toBe(1);
    expect(await contar(ds, 'SELECT count(*) AS n FROM mascota')).toBe(4);
    expect(await contar(ds, 'SELECT count(*) AS n FROM foto_mascota WHERE es_principal')).toBe(4);
    expect(await contar(ds, 'SELECT count(*) AS n FROM usuario')).toBe(2);
  });
});
