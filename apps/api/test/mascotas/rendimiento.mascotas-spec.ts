import 'reflect-metadata';
import { PostgresQueryRunner } from 'typeorm/driver/postgres/PostgresQueryRunner';
import { arrancarEntorno, type Entorno } from '../auth/helpers';

// V11 — rendimiento (R24): 30 000 mascotas generadas con generate_series; cada consulta del
// catálogo debe responder en menos de 2 s y el listado base debe usar `idx_mascota_catalogo`.
const UMBRAL_MS = 2000;
const TOTAL = 30_000;
const FUNDACIONES = 20;

describe('V11 — rendimiento del catálogo con 30 000 mascotas', () => {
  let e: Entorno;
  let especiePerro: number;

  beforeAll(async () => {
    e = await arrancarEntorno();
    const ciudades = ['Bogotá', 'Medellín', 'Cali', 'Montería', 'Cartagena'];
    await e.ds
      .query(`INSERT INTO usuario (rol_id, email, contrasena, telefono, email_verificado, acepta_politica_datos)
      SELECT (SELECT id FROM rol WHERE nombre = 'fundacion'), 'perf-' || g || '@example.com', 'x', '3000000000', true, true
      FROM generate_series(1, ${FUNDACIONES}) g`);
    await e.ds.query(
      `INSERT INTO fundacion (usuario_id, nombre, nit, direccion, ciudad, documento_url, estado_validacion, fecha_validacion)
       SELECT u.id, 'Fundación ' || n, 'perf-' || n, 'Calle ' || n, ($1::text[])[1 + (n % 5)], 'privado/fundaciones/x.pdf', 'aprobada', now()
       FROM (SELECT id, row_number() OVER (ORDER BY id) AS n FROM usuario WHERE email LIKE 'perf-%') u`,
      [ciudades],
    );
    // 4 razas (2 de perro y 2 de gato), estados mezclados y 30 % con foto principal.
    await e.ds
      .query(`INSERT INTO mascota (fundacion_id, raza_id, nombre, sexo, edad_meses, tamano, estado_salud, estado, fecha_publicacion)
      SELECT (SELECT id FROM fundacion WHERE nit = 'perf-' || (1 + g % ${FUNDACIONES})),
             (ARRAY(SELECT id FROM raza WHERE nombre IN ('Mestizo', 'Labrador', 'Siamés', 'Persa') ORDER BY id))[1 + g % 4],
             'Mascota ' || g,
             (ARRAY['macho', 'hembra'])[1 + g % 2]::mascota_sexo_enum,
             g % 200,
             (ARRAY['pequeño', 'mediano', 'grande'])[1 + g % 3]::mascota_tamano_enum,
             'Sano',
             (ARRAY['disponible', 'disponible', 'disponible', 'disponible', 'disponible', 'disponible', 'disponible', 'en_proceso', 'adoptada', 'inactiva'])[1 + g % 10]::mascota_estado_enum,
             now() - (g || ' minutes')::interval
      FROM generate_series(1, ${TOTAL}) g`);
    await e.ds.query(`INSERT INTO foto_mascota (mascota_id, url, url_catalogo, es_principal)
      SELECT id, 'publico/mascotas/' || gen_random_uuid() || '.jpg', 'publico/mascotas/' || gen_random_uuid() || '.jpg', true
      FROM mascota WHERE id % 10 < 3`);
    await e.ds.query('ANALYZE mascota');
    await e.ds.query('ANALYZE foto_mascota');
    await e.ds.query('ANALYZE fundacion');
    [{ id: especiePerro }] = await e.ds.query(`SELECT id FROM especie WHERE nombre = 'perro'`);
  });
  afterAll(() => e?.cerrar());

  async function medir(etiqueta: string, ruta: string) {
    const inicio = performance.now();
    const res = await e.get(ruta).expect(200);
    const ms = Math.round(performance.now() - inicio);
    process.stdout.write(
      `[V11] ${etiqueta}: ${ms} ms (total=${res.body.total}, filas=${res.body.data.length})\n`,
    );
    expect(ms).toBeLessThan(UMBRAL_MS);
    return res.body as { data: { id: number }[]; total: number };
  }

  it('hay 30 000 mascotas con el reparto esperado', async () => {
    const [{ n, d, f }] = await e.ds.query(
      `SELECT count(*)::int AS n, count(*) FILTER (WHERE estado = 'disponible')::int AS d,
              (SELECT count(*)::int FROM foto_mascota) AS f FROM mascota`,
    );
    expect([n, d]).toEqual([TOTAL, 21_000]);
    expect(f).toBe(9_000);
  });

  it('GET /mascotas sin filtros, con filtros combinados, página 100 y límite máximo responden en menos de 2 s', async () => {
    const base = await medir('sin filtros (limit 12)', '/mascotas');
    expect(base.total).toBe(21_000);
    expect(base.data).toHaveLength(12);
    await medir(
      'filtros combinados',
      `/mascotas?especieId=${especiePerro}&tamano=mediano&edadMinMeses=12&edadMaxMeses=120&ciudad=bogota`,
    );
    const pagina = await medir('página 100', '/mascotas?page=100');
    expect(pagina.data).toHaveLength(12);
    await medir('página 1750 (la última)', '/mascotas?page=1750');
    await medir('limit 100', '/mascotas?limit=100');
    await medir('solo ciudad', '/mascotas?ciudad=MEDELLÍN');
  });

  it('el listado base usa idx_mascota_catalogo (EXPLAIN)', async () => {
    const consultas: { sql: string; params: unknown[] }[] = [];
    const original = PostgresQueryRunner.prototype.query;
    const espia = jest.spyOn(PostgresQueryRunner.prototype, 'query').mockImplementation(function (
      this: PostgresQueryRunner,
      ...args: unknown[]
    ) {
      consultas.push({ sql: String(args[0]), params: (args[1] as unknown[]) ?? [] });
      return (original as (...a: unknown[]) => Promise<unknown>).apply(this, args);
    } as never);
    try {
      await e.get('/mascotas').expect(200);
    } finally {
      espia.mockRestore();
    }
    const listado = consultas.find(
      (c) => /LEFT JOIN "foto_mascota"/.test(c.sql) && /LIMIT 12/.test(c.sql),
    );
    expect(listado).toBeDefined();
    const plan: Record<string, string>[] = await e.ds.query(
      `EXPLAIN (ANALYZE, BUFFERS) ${listado!.sql}`,
      listado!.params,
    );
    const texto = plan.map((f) => f['QUERY PLAN']).join('\n');
    process.stdout.write(`[V11] EXPLAIN ANALYZE del listado base:\n${texto}\n`);
    expect(texto).toContain('idx_mascota_catalogo');
    expect(texto).not.toMatch(/Seq Scan on mascota/);
    const ejecucion = /Execution Time: ([\d.]+) ms/.exec(texto);
    expect(Number(ejecucion?.[1])).toBeLessThan(UMBRAL_MS);
  });
});
