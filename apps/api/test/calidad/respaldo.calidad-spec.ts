import 'reflect-metadata';
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { DataSource } from 'typeorm';
import { crearOpcionesTypeOrm } from '../../src/database/typeorm.options';
import { arrancarEntorno, type Entorno } from '../auth/helpers';
import { conexion, NOMBRE_BD_PRUEBA } from '../db/db-helper';
import {
  adoptanteConSesion,
  con,
  fechaBogota,
  fundacionAprobada,
  type FundacionPrueba,
  jpeg,
  PDF,
} from '../seguimientos/helpers';
import { CUERPO_MASCOTA } from '../mascotas/helpers';

// V15 (respaldo): scripts/respaldo.sh genera un volcado de PostgreSQL y una copia de uploads/; con
// scripts/restaurar.sh el volcado se restaura en una base limpia con los MISMOS datos (conteos por tabla y
// hash del contenido). Requiere Postgres (DATABASE_*), Mailpit y `pg_dump` en el equipo (o Docker Compose
// con el servicio postgres, que el script usa si no; PG_MODO fuerza uno u otro).
const exec = promisify(execFile);
const RAIZ = path.resolve(__dirname, '..', '..', '..', '..');
const RESPALDO = path.join(RAIZ, 'scripts', 'respaldo.sh');
const RESTAURAR = path.join(RAIZ, 'scripts', 'restaurar.sh');
const BASE_RESTAURADA = `${NOMBRE_BD_PRUEBA}_restore`;
const CLAVE_BD = 'pethogar';

interface Resultado {
  codigo: number;
  salida: string;
}

async function correr(
  script: string,
  args: string[],
  extra: Record<string, string>,
): Promise<Resultado> {
  try {
    const { stdout, stderr } = await exec(script, args, {
      env: { ...process.env, ...extra },
      cwd: RAIZ,
    });
    return { codigo: 0, salida: stdout + stderr };
  } catch (error) {
    const e = error as { code?: number; stdout?: string; stderr?: string };
    return { codigo: e.code ?? 1, salida: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

describe('V15 — respaldo y restauración (pg_dump, uploads y base limpia)', () => {
  let e: Entorno;
  let respaldos: string;
  let destinoUploads: string;
  let F: FundacionPrueba;
  let conexionRestaurada: DataSource | undefined;

  const entorno = (extra: Record<string, string> = {}): Record<string, string> => ({
    DATABASE_HOST: conexion.host,
    DATABASE_PORT: String(conexion.port),
    DATABASE_USER: conexion.user,
    DATABASE_PASSWORD: process.env.DATABASE_PASSWORD ?? conexion.password ?? CLAVE_BD,
    DATABASE_NAME: NOMBRE_BD_PRUEBA,
    UPLOADS_DIR: e.uploads,
    BACKUP_DIR: respaldos,
    ...extra,
  });

  const borrarRestaurada = async (): Promise<void> => {
    await conexionRestaurada?.destroy();
    conexionRestaurada = undefined;
    await e.ds
      .query(`DROP DATABASE IF EXISTS "${BASE_RESTAURADA}" WITH (FORCE)`)
      .catch(() => undefined);
  };
  const abrirRestaurada = async (): Promise<DataSource> => {
    conexionRestaurada = new DataSource(
      crearOpcionesTypeOrm({
        DATABASE_HOST: conexion.host,
        DATABASE_PORT: conexion.port,
        DATABASE_USER: conexion.user,
        DATABASE_PASSWORD: conexion.password,
        DATABASE_NAME: BASE_RESTAURADA,
      }),
    );
    await conexionRestaurada.initialize();
    return conexionRestaurada;
  };

  /** Conteo por tabla y hash del contenido de las tablas con datos del dominio. */
  async function huella(ds: DataSource): Promise<Record<string, { filas: number; hash: string }>> {
    const tablas = (await ds.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
    )) as { table_name: string }[];
    const salida: Record<string, { filas: number; hash: string }> = {};
    for (const { table_name: t } of tablas) {
      const [r] = (await ds.query(
        `SELECT count(*)::int AS filas,
                coalesce(md5(string_agg(x::text, '|' ORDER BY x::text)), '') AS hash FROM "${t}" x`,
      )) as { filas: number; hash: string }[];
      salida[t] = r;
    }
    return salida;
  }

  const listarArchivos = (dir: string): string[] =>
    readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((f) => f.isFile())
      .map((f) => path.relative(dir, path.join(f.parentPath, f.name)))
      .sort();

  beforeAll(async () => {
    process.env.SEGUIMIENTOS_CRON_HABILITADO = 'false';
    e = await arrancarEntorno();
    respaldos = mkdtempSync(path.join(tmpdir(), 'pethogar-respaldos-'));
    destinoUploads = mkdtempSync(path.join(tmpdir(), 'pethogar-uploads-restaurados-'));
    // Datos reales con archivos en disco: fundación, mascota con foto, solicitud, donación con comprobante.
    F = await fundacionAprobada(e, 'Montería');
    const razaId = (
      (await e.ds.query(`SELECT id FROM raza WHERE nombre = 'Mestizo' LIMIT 1`)) as { id: number }[]
    )[0].id;
    const m = await con(e.post('/mascotas'), F.access)
      .send({ ...CUERPO_MASCOTA, razaId, nombre: 'Peñita' })
      .expect(201);
    await con(e.post(`/mascotas/${m.body.id}/fotos`), F.access)
      .attach('foto', await jpeg(30, 20), { filename: 'f.jpg', contentType: 'image/jpeg' })
      .expect(201);
    const adoptante = await adoptanteConSesion(e);
    await con(e.post('/solicitudes'), adoptante.access)
      .field('mascotaId', String(m.body.id))
      .field('motivo', 'Quiero darle un hogar con ñ y acentos: cariño')
      .field('tipoVivienda', 'casa')
      .field('tieneOtrasMascotas', 'false')
      .attach('formulario', PDF, { filename: 'f.pdf', contentType: 'application/pdf' })
      .expect(201);
    await con(e.post('/donaciones'), adoptante.access)
      .field('fundacionId', String(F.id))
      .field('tipo', 'economica')
      .field('monto', '12345.67')
      .attach('comprobante', PDF, { filename: 'c.pdf', contentType: 'application/pdf' })
      .expect(201);
    expect(fechaBogota(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await e.ds.query(`DROP DATABASE IF EXISTS "${BASE_RESTAURADA}" WITH (FORCE)`);
  });
  afterAll(async () => {
    await borrarRestaurada();
    rmSync(respaldos, { recursive: true, force: true });
    rmSync(destinoUploads, { recursive: true, force: true });
    await e?.cerrar();
  });

  it('respalda la base y los archivos, y la restauración deja exactamente los mismos datos', async () => {
    const respaldo = await correr(RESPALDO, [], entorno());
    expect(respaldo.salida).not.toContain(CLAVE_BD + '\n');
    expect(respaldo.codigo).toBe(0);
    const archivos = readdirSync(respaldos);
    const dump = archivos.find((a) => /^pethogar-\d{8}T\d{6}Z\.dump$/.test(a));
    const tar = archivos.find((a) => /^uploads-\d{8}T\d{6}Z\.tar\.gz$/.test(a));
    expect(dump).toBeDefined();
    expect(tar).toBeDefined();
    expect(archivos.filter((a) => a.endsWith('.tmp'))).toEqual([]);

    const restauracion = await correr(
      RESTAURAR,
      [path.join(respaldos, dump!), BASE_RESTAURADA, path.join(respaldos, tar!), destinoUploads],
      entorno(),
    );
    expect(restauracion.codigo).toBe(0);

    const restaurada = await abrirRestaurada();
    const original = await huella(e.ds);
    const copia = await huella(restaurada);
    expect(Object.keys(copia).sort()).toEqual(Object.keys(original).sort());
    expect(copia).toEqual(original);
    // La prueba no es vacua: hay datos reales en las tablas del dominio.
    for (const tabla of [
      'usuario',
      'fundacion',
      'mascota',
      'foto_mascota',
      'solicitud_adopcion',
      'donacion',
    ]) {
      expect(original[tabla].filas).toBeGreaterThan(0);
    }
    // Las restricciones y los índices también viajan (p. ej. el índice único parcial y los de reportes).
    const indices = (await restaurada.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx\\_%' ORDER BY 1`,
    )) as { indexname: string }[];
    expect(indices.map((i) => i.indexname)).toEqual(
      expect.arrayContaining([
        'idx_adopcion_fecha',
        'idx_solicitud_estado_fecha',
        'idx_seguimiento_fecha',
      ]),
    );
    // Los archivos restaurados son los del disco de origen.
    expect(listarArchivos(destinoUploads)).toEqual(listarArchivos(e.uploads));
    expect(listarArchivos(e.uploads).length).toBeGreaterThanOrEqual(4);
  });

  it('no sobrescribe una base existente ni imprime la contraseña', async () => {
    const dump = readdirSync(respaldos).find((a) => a.endsWith('.dump'))!;
    const otra = await correr(RESTAURAR, [path.join(respaldos, dump), BASE_RESTAURADA], entorno());
    expect(otra.codigo).not.toBe(0);
    expect(otra.salida).toMatch(/ya existe/);
    expect(otra.salida).not.toContain(CLAVE_BD + '\n');
    // La base restaurada sigue intacta.
    expect(
      (
        (await conexionRestaurada!.query('SELECT count(*)::int AS n FROM donacion')) as {
          n: number;
        }[]
      )[0].n,
    ).toBe(1);
  });

  it('valida los argumentos: sin ellos, con un nombre peligroso o con un volcado inexistente', async () => {
    expect((await correr(RESTAURAR, [], entorno())).codigo).toBe(2);
    const dump = path.join(
      respaldos,
      readdirSync(respaldos).find((a) => a.endsWith('.dump'))!,
    );
    const peligroso = await correr(RESTAURAR, [dump, 'x"; DROP DATABASE postgres; --'], entorno());
    expect(peligroso.codigo).toBe(2);
    expect((await correr(RESTAURAR, ['/no/existe.dump', 'otra_base'], entorno())).codigo).toBe(2);
    const bases = (await e.ds.query(
      `SELECT 1 FROM pg_database WHERE datname = 'postgres'`,
    )) as unknown[];
    expect(bases).toHaveLength(1);
  });

  it('un volcado corrupto falla y no deja una base a medias', async () => {
    const corrupto = path.join(respaldos, 'corrupto.dump');
    writeFileSync(corrupto, 'esto no es un volcado de postgres');
    const res = await correr(RESTAURAR, [corrupto, `${BASE_RESTAURADA}_2`], entorno());
    expect(res.codigo).not.toBe(0);
    const filas = (await e.ds.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [
      `${BASE_RESTAURADA}_2`,
    ])) as unknown[];
    expect(filas).toHaveLength(0);
  });

  it('si la base no se puede volcar, falla sin dejar archivos a medias', async () => {
    const vacio = mkdtempSync(path.join(tmpdir(), 'pethogar-respaldos-fallo-'));
    try {
      const res = await correr(
        RESPALDO,
        [],
        entorno({ DATABASE_NAME: 'base_que_no_existe', BACKUP_DIR: vacio }),
      );
      expect(res.codigo).not.toBe(0);
      expect(readdirSync(vacio)).toEqual([]);
    } finally {
      rmSync(vacio, { recursive: true, force: true });
    }
  });

  it('rota los respaldos más antiguos que la retención y conserva los recientes', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pethogar-respaldos-rotacion-'));
    try {
      const viejo = path.join(dir, 'pethogar-20200101T000000Z.dump');
      const viejoTar = path.join(dir, 'uploads-20200101T000000Z.tar.gz');
      const ajeno = path.join(dir, 'notas.txt');
      for (const f of [viejo, viejoTar, ajeno]) writeFileSync(f, 'x');
      const hace30Dias = new Date(Date.now() - 30 * 86_400_000);
      for (const f of [viejo, viejoTar, ajeno]) utimesSync(f, hace30Dias, hace30Dias);
      const res = await correr(
        RESPALDO,
        [],
        entorno({ BACKUP_DIR: dir, BACKUP_RETENCION_DIAS: '14' }),
      );
      expect(res.codigo).toBe(0);
      expect(existsSync(viejo)).toBe(false);
      expect(existsSync(viejoTar)).toBe(false);
      expect(existsSync(ajeno)).toBe(true); // solo rota sus propios archivos
      expect(readdirSync(dir).filter((a) => /^pethogar-.*\.dump$/.test(a))).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
