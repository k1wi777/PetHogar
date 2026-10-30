import * as bcrypt from 'bcryptjs';
import type { DataSource } from 'typeorm';
import { RAZAS_POR_ESPECIE } from '../../src/database/seeds/catalogos.data';
import { sembrarBase } from '../../src/database/seeds/seed';
import type { SeedConfig } from '../../src/database/seeds/seed.config';
import { sembrarDemo } from '../../src/database/seeds/seed.demo';
import {
  ADOPCIONES_DEMO,
  DONACIONES_DEMO,
  SEGUIMIENTOS_DEMO,
  SOLICITUDES_DEMO,
} from '../../src/database/seeds/seed.demo.data';
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

  it('--demo dos veces deja 1 fundación aprobada, 7 mascotas con foto y la actividad sin duplicar', async () => {
    await ejecutar(true);
    const conteos = async () => ({
      mascota: await contar(ds, 'SELECT count(*) AS n FROM mascota'),
      solicitud: await contar(ds, 'SELECT count(*) AS n FROM solicitud_adopcion'),
      adopcion: await contar(ds, 'SELECT count(*) AS n FROM adopcion'),
      seguimiento: await contar(ds, 'SELECT count(*) AS n FROM seguimiento'),
      donacion: await contar(ds, 'SELECT count(*) AS n FROM donacion'),
      notificacion: await contar(ds, 'SELECT count(*) AS n FROM notificacion'),
      usuario: await contar(ds, 'SELECT count(*) AS n FROM usuario'),
    });
    const primera = await conteos();
    await ejecutar(true);
    expect(await conteos()).toEqual(primera);

    expect(
      await contar(ds, `SELECT count(*) AS n FROM fundacion WHERE estado_validacion = 'aprobada'`),
    ).toBe(1);
    expect(primera).toEqual({
      mascota: 7,
      solicitud: SOLICITUDES_DEMO.length,
      adopcion: ADOPCIONES_DEMO.length,
      seguimiento: SEGUIMIENTOS_DEMO.length,
      donacion: DONACIONES_DEMO.length,
      notificacion: 14,
      usuario: 3,
    });
    expect(await contar(ds, 'SELECT count(*) AS n FROM adoptante')).toBe(1);
    expect(await contar(ds, 'SELECT count(*) AS n FROM foto_mascota WHERE es_principal')).toBe(7);
    expect(
      await contar(ds, 'SELECT count(*) AS n FROM foto_mascota WHERE url_catalogo IS NOT NULL'),
    ).toBe(7);
    // El catálogo público sigue mostrando las 4 disponibles.
    expect(await contar(ds, `SELECT count(*) AS n FROM mascota WHERE estado = 'disponible'`)).toBe(
      4,
    );
  });

  it('el demo respeta las máquinas de estado (aprobada ⇔ adopción ⇔ mascota adoptada)', async () => {
    const porEstado = async (sql: string) =>
      Object.fromEntries(
        (await ds.query<{ estado: string; n: string }[]>(sql)).map((f) => [f.estado, Number(f.n)]),
      );
    expect(
      await porEstado(`SELECT estado, count(*) AS n FROM solicitud_adopcion GROUP BY estado`),
    ).toEqual({ pendiente: 2, aprobada: 3, rechazada: 2, cancelada: 1 });
    expect(await porEstado(`SELECT estado, count(*) AS n FROM adopcion GROUP BY estado`)).toEqual({
      activa: 2,
      finalizada: 1,
    });
    expect(
      await porEstado(`SELECT estado, count(*) AS n FROM seguimiento GROUP BY estado`),
    ).toEqual({ programado: 2, vencido: 2, realizado: 6, cancelado: 1 });

    // Toda solicitud aprobada tiene exactamente una adopción y su mascota queda adoptada.
    expect(
      await contar(
        ds,
        `SELECT count(*) AS n FROM solicitud_adopcion s
          LEFT JOIN adopcion a ON a.solicitud_id = s.id
          JOIN mascota m ON m.id = s.mascota_id
         WHERE (s.estado = 'aprobada') <> (a.id IS NOT NULL)
            OR (s.estado = 'aprobada' AND m.estado <> 'adoptada')`,
      ),
    ).toBe(0);
    expect(await contar(ds, `SELECT count(*) AS n FROM mascota WHERE estado = 'adoptada'`)).toBe(3);
    // Rechazos y cancelaciones llevan respuesta; las pendientes no.
    expect(
      await contar(
        ds,
        `SELECT count(*) AS n FROM solicitud_adopcion
          WHERE (estado = 'pendiente') <> (fecha_respuesta IS NULL)`,
      ),
    ).toBe(0);
    // `cancelado` solo existe en una adopción cerrada; `realizado` lleva fecha y bienestar.
    expect(
      await contar(
        ds,
        `SELECT count(*) AS n FROM seguimiento sg JOIN adopcion a ON a.id = sg.adopcion_id
          WHERE sg.estado = 'cancelado' AND (a.estado = 'activa' OR a.fecha_cierre IS NULL)`,
      ),
    ).toBe(0);
    expect(
      await contar(
        ds,
        `SELECT count(*) AS n FROM seguimiento
          WHERE (estado = 'realizado') <> (fecha_realizada IS NOT NULL AND estado_bienestar IS NOT NULL)`,
      ),
    ).toBe(0);
    // Las fechas de los seguimientos son posteriores a la entrega.
    expect(
      await contar(
        ds,
        `SELECT count(*) AS n FROM seguimiento sg JOIN adopcion a ON a.id = sg.adopcion_id
          WHERE sg.fecha_programada <= a.fecha_entrega`,
      ),
    ).toBe(0);
    // Un seguimiento programado es futuro y uno vencido es pasado.
    expect(
      await contar(
        ds,
        `SELECT count(*) AS n FROM seguimiento
          WHERE (estado = 'programado' AND fecha_programada <= current_date)
             OR (estado = 'vencido' AND fecha_programada >= current_date)`,
      ),
    ).toBe(0);
  });
});
