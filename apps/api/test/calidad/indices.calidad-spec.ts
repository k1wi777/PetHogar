import 'reflect-metadata';
import type { EntityManager } from 'typeorm';
import { EstadisticasService } from '../../src/modules/reportes/estadisticas.service';
import { ReportesPdfService } from '../../src/modules/reportes/reportes-pdf.service';
import { ReportesRepository } from '../../src/modules/reportes/reportes.repository';
import { arrancarEntorno, type Entorno } from '../auth/helpers';

// V15 (índices y volumen): con un volumen representativo, las estadísticas y los listados de los PDF
// responden dentro del umbral y las consultas se ejecutan con los índices de IndicesReportes cuando
// el planificador los elige. El criterio es el TIEMPO: con poca cardinalidad Postgres puede preferir
// un recorrido secuencial, y eso es correcto. Imprime los planes para revisarlos.
// Requiere Postgres (DATABASE_*) y Mailpit (SMTP_HOST/SMTP_PORT y MAILPIT_UI_PORT).
const UMBRAL_FUNDACION_MS = 1000;
const UMBRAL_GLOBAL_MS = 2000;
const FUNDACIONES = 20;
const MASCOTAS = 30_000;
const ADOPTANTES = 300;
const SOLICITUDES = 60_000;

describe('V15 — índices de reportes con volumen representativo', () => {
  let e: Entorno;
  let fundacionId: number;
  const planes: string[] = [];

  beforeAll(async () => {
    process.env.SEGUIMIENTOS_CRON_HABILITADO = 'false';
    e = await arrancarEntorno();
    const q = (sql: string, p: unknown[] = []): Promise<unknown> => e.ds.query(sql, p);
    await q(`INSERT INTO usuario (rol_id, email, contrasena, telefono, email_verificado, acepta_politica_datos)
      SELECT (SELECT id FROM rol WHERE nombre = 'fundacion'), 'vol-f-' || g || '@example.com', 'x', '3000000000', true, true
        FROM generate_series(1, ${FUNDACIONES}) g`);
    await q(`INSERT INTO usuario (rol_id, email, contrasena, telefono, email_verificado, acepta_politica_datos)
      SELECT (SELECT id FROM rol WHERE nombre = 'adoptante'), 'vol-a-' || g || '@example.com', 'x', '3000000000', true, true
        FROM generate_series(1, ${ADOPTANTES}) g`);
    await q(`INSERT INTO fundacion (usuario_id, nombre, nit, direccion, ciudad, documento_url, estado_validacion, fecha_validacion)
      SELECT u.id, 'Fundación ' || n, 'vol-' || n, 'Calle ' || n, 'Montería', 'privado/fundaciones/x.pdf', 'aprobada', now()
        FROM (SELECT id, row_number() OVER (ORDER BY id) AS n FROM usuario WHERE email LIKE 'vol-f-%') u`);
    await q(`INSERT INTO adoptante (usuario_id, primer_nombre, primer_apellido, tipo_documento, numero_documento,
                                    fecha_nacimiento, direccion, ciudad)
      SELECT u.id, 'Ana', 'Pérez', 'CC', 'vol-' || n, '1990-01-01', 'Calle 1', 'Montería'
        FROM (SELECT id, row_number() OVER (ORDER BY id) AS n FROM usuario WHERE email LIKE 'vol-a-%') u`);
    await q(`INSERT INTO mascota (fundacion_id, raza_id, nombre, sexo, edad_meses, tamano, estado_salud)
      SELECT (SELECT id FROM fundacion WHERE nit = 'vol-' || (1 + g % ${FUNDACIONES})),
             (ARRAY(SELECT id FROM raza WHERE nombre IN ('Mestizo', 'Labrador', 'Siamés', 'Persa') ORDER BY id))[1 + g % 4],
             'Mascota ' || g, 'macho', g % 200, 'mediano', 'Sano'
        FROM generate_series(1, ${MASCOTAS}) g`);
    // Solicitudes repartidas en 24 meses; `pendiente` solo en la primera vuelta (índice único parcial).
    await q(`INSERT INTO solicitud_adopcion (adoptante_id, mascota_id, fecha_solicitud, motivo, tipo_vivienda,
                                             tiene_otras_mascotas, formulario_url, estado)
      SELECT (SELECT min(id) FROM adoptante) + (g % ${ADOPTANTES}),
             (SELECT min(id) FROM mascota) + (g % ${MASCOTAS}),
             now() - ((g % 730) || ' days')::interval,
             'Motivo', 'casa', false, 'privado/solicitudes/x.pdf',
             (CASE WHEN g <= ${MASCOTAS} AND g % 5 = 0 THEN 'pendiente'
                   ELSE (ARRAY['aprobada', 'rechazada', 'cancelada', 'aprobada'])[1 + g % 4] END)::solicitud_adopcion_estado_enum
        FROM generate_series(1, ${SOLICITUDES}) g`);
    await q(`INSERT INTO adopcion (solicitud_id, fecha_entrega, estado)
      SELECT id, (fecha_solicitud + interval '3 days')::date, 'activa'
        FROM solicitud_adopcion WHERE estado = 'aprobada'`);
    await q(`INSERT INTO seguimiento (adopcion_id, tipo, fecha_programada, fecha_realizada, estado, estado_bienestar)
      SELECT a.id, (ARRAY['visita', 'reporte'])[1 + k % 2]::seguimiento_tipo_enum,
             a.fecha_entrega + (k * 15),
             CASE WHEN k % 3 = 0 THEN a.fecha_entrega + (k * 15) END,
             (CASE WHEN k % 3 = 0 THEN 'realizado' WHEN k % 3 = 1 THEN 'programado' ELSE 'vencido' END)::seguimiento_estado_enum,
             CASE WHEN k % 3 = 0 THEN 'bueno'::seguimiento_estado_bienestar_enum END
        FROM adopcion a CROSS JOIN generate_series(1, 3) k`);
    await q(`INSERT INTO donacion (fundacion_id, tipo, monto, descripcion_especie, nombre_donante, fecha)
      SELECT (SELECT id FROM fundacion WHERE nit = 'vol-' || (1 + g % ${FUNDACIONES})),
             (CASE WHEN g % 4 = 0 THEN 'especie' ELSE 'economica' END)::donacion_tipo_enum,
             CASE WHEN g % 4 = 0 THEN NULL ELSE (g % 1000) + 0.50 END,
             CASE WHEN g % 4 = 0 THEN 'Insumos' END,
             'Donante ' || g, now() - ((g % 730) || ' days')::interval
        FROM generate_series(1, 50000) g`);
    for (const t of [
      'mascota',
      'solicitud_adopcion',
      'adopcion',
      'seguimiento',
      'donacion',
      'fundacion',
    ]) {
      await q(`ANALYZE ${t}`);
    }
    [{ id: fundacionId }] = (await q(`SELECT id FROM fundacion WHERE nit = 'vol-3'`)) as {
      id: number;
    }[];
  });
  afterAll(async () => {
    process.stdout.write(`\n${planes.join('\n\n')}\n`);
    await e?.cerrar();
  });

  /** Ejecuta `fn` con un manager que solo registra el SQL, y devuelve el plan real de cada sentencia. */
  async function planesDe(
    etiqueta: string,
    fn: (m: EntityManager) => Promise<unknown>,
  ): Promise<string[]> {
    const sentencias: { sql: string; parametros: unknown[] }[] = [];
    const falso = {
      query: (sql: string, parametros: unknown[] = []) => {
        sentencias.push({ sql, parametros });
        return Promise.resolve([{ total: 0 }]);
      },
    } as unknown as EntityManager;
    await fn(falso);
    const salida: string[] = [];
    for (const { sql, parametros } of sentencias) {
      const filas = (await e.ds.query(
        `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF) ${sql}`,
        parametros,
      )) as {
        'QUERY PLAN': string;
      }[];
      const plan = filas.map((f) => f['QUERY PLAN']).join('\n');
      planes.push(`── ${etiqueta}\n${plan}`);
      salida.push(plan);
    }
    return salida;
  }

  const repo = new ReportesRepository();
  const rango = {
    desde: '2025-06-01',
    hasta: '2025-12-31',
    desdeInstante: new Date('2025-06-01T05:00:00Z'),
    hastaExclusivo: new Date('2026-01-01T05:00:00Z'),
  };

  it('las estadísticas de una fundación con rango responden dentro del umbral', async () => {
    const servicio = e.app.get(EstadisticasService);
    const t0 = performance.now();
    const r = await servicio.deFundacion(fundacionId, '2025-06-01', '2025-12-31');
    const ms = performance.now() - t0;
    process.stdout.write(`\nestadísticas de la fundación (rango): ${Math.round(ms)} ms\n`);
    expect(r.solicitudes.total).toBeGreaterThan(0);
    expect(ms).toBeLessThan(UMBRAL_FUNDACION_MS);
  });

  it('las estadísticas globales sin filtros responden dentro del umbral', async () => {
    const servicio = e.app.get(EstadisticasService);
    const t0 = performance.now();
    const r = await servicio.deAdministrador(undefined);
    const ms = performance.now() - t0;
    process.stdout.write(`\nestadísticas globales: ${Math.round(ms)} ms\n`);
    expect(r.solicitudes.total).toBe(SOLICITUDES);
    expect(ms).toBeLessThan(UMBRAL_GLOBAL_MS);
  });

  it('las consultas usan los índices de IndicesReportes (si se dejara de usar alguno, se elimina de la migración)', async () => {
    const f = { fundacionId, ...rango };
    const [adopciones] = await planesDe('adopciones por mes (fundación + rango)', (m) =>
      repo.adopcionesPorMes(f, m),
    );
    expect(adopciones).toContain('idx_adopcion_fecha');

    const [seguimientos] = await planesDe('seguimientos por estado (global + rango)', (m) =>
      repo.seguimientosPorEstado({ ...rango }, '2026-06-01', m),
    );
    expect(seguimientos).toContain('idx_seguimiento_fecha');

    const [lista] = await planesDe('PDF solicitudes estado=aprobada (fundación + rango)', (m) =>
      repo.listarSolicitudes(f, 'aprobada' as never, 1000, m),
    );
    expect(lista).toContain('idx_solicitud_estado_fecha');
    expect(lista).toMatch(/estado = 'aprobada'/);

    const [donaciones] = await planesDe('donaciones por mes (fundación + rango)', (m) =>
      repo.donacionesPorMes(f, m),
    );
    expect(donaciones).toContain('idx_donacion_fundacion_fecha');
  });

  it('planes del resto de consultas (informativo)', async () => {
    const f = { fundacionId, ...rango };
    await planesDe('solicitudes por estado (fundación + rango)', (m) =>
      repo.solicitudesPorEstado(f, m),
    );
    await planesDe('solicitudes por estado (global + rango)', (m) =>
      repo.solicitudesPorEstado({ ...rango }, m),
    );
    await planesDe('adopciones por mes (global + rango)', (m) =>
      repo.adopcionesPorMes({ ...rango }, m),
    );
    await planesDe('seguimientos por estado (fundación + rango)', (m) =>
      repo.seguimientosPorEstado(f, '2026-06-01', m),
    );
    await planesDe('PDF seguimientos (fundación + rango)', (m) =>
      repo.listarSeguimientos(f, undefined, '2026-06-01', 1000, m),
    );
    await planesDe('PDF donaciones (fundación + rango)', (m) =>
      repo.listarDonaciones(fundacionId, f, undefined, 1000, m),
    );
  });

  it('un PDF de 1000 filas (de 3000 solicitudes de la fundación) se genera en menos de 5 s', async () => {
    const pdf = e.app.get(ReportesPdfService);
    const t0 = performance.now();
    const buffer = await pdf.solicitudes(fundacionId, {});
    const ms = performance.now() - t0;
    process.stdout.write(
      `\nPDF de solicitudes (1000 filas): ${Math.round(ms)} ms, ${buffer.length} bytes\n`,
    );
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(ms).toBeLessThan(5000);
  });
});
