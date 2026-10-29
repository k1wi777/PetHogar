import 'reflect-metadata';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import type { AddressInfo } from 'node:net';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { configurarApp } from '../../src/app.setup';
import { sembrarBase } from '../../src/database/seeds/seed';
import {
  borrarBaseDePrueba,
  conexion,
  crearDataSource,
  NOMBRE_BD_PRUEBA,
  recrearBaseDePrueba,
} from '../db/db-helper';

/**
 * V16 — prueba de carga ligera del catálogo público: 200 usuarios simulados y concurrentes, cada uno con
 * varias consultas (listado con filtros y paginación, y ficha), sobre 30 000 mascotas. Falla (código ≠ 0)
 * si el promedio es de 2 s o más, o si alguna respuesta no es 200.
 *
 * Sin dependencias nuevas: `fetch` nativo de Node y la API real en proceso, en un puerto efímero (no usa
 * 3001). Crea la base `${DATABASE_NAME}_test`, la carga con `generate_series` y la borra al terminar.
 * Cada usuario envía un `X-Forwarded-For` distinto con `TRUST_PROXY=1`, de modo que el límite de peticiones
 * por IP se ejerce de forma realista sin desactivarlo.
 *
 * Variables: `CARGA_USUARIOS` (200), `CARGA_UMBRAL_MS` (2000), `CARGA_MASCOTAS` (30000) y `DATABASE_*`.
 * Con `CARGA_URL=http://host:puerto/api` apunta a una API ya levantada (con `TRUST_PROXY=1`) y no crea nada.
 */
const USUARIOS = Number(process.env.CARGA_USUARIOS ?? 200);
const UMBRAL_MS = Number(process.env.CARGA_UMBRAL_MS ?? 2000);
const MASCOTAS = Number(process.env.CARGA_MASCOTAS ?? 30_000);
const FUNDACIONES = 20;
const CONSULTAS_POR_USUARIO = 5;

interface Medicion {
  ms: number;
  estado: number;
  ruta: string;
}

async function cargarDatos(ds: DataSource): Promise<void> {
  const ciudades = ['Bogotá', 'Medellín', 'Cali', 'Montería', 'Cartagena'];
  await ds.query(`INSERT INTO usuario (rol_id, email, contrasena, telefono, email_verificado, acepta_politica_datos)
    SELECT (SELECT id FROM rol WHERE nombre = 'fundacion'), 'carga-' || g || '@example.com', 'x', '3000000000', true, true
      FROM generate_series(1, ${FUNDACIONES}) g`);
  await ds.query(
    `INSERT INTO fundacion (usuario_id, nombre, nit, direccion, ciudad, documento_url, estado_validacion, fecha_validacion)
     SELECT u.id, 'Fundación ' || n, 'carga-' || n, 'Calle ' || n, ($1::text[])[1 + (n % 5)], 'privado/fundaciones/x.pdf', 'aprobada', now()
       FROM (SELECT id, row_number() OVER (ORDER BY id) AS n FROM usuario WHERE email LIKE 'carga-%') u`,
    [ciudades],
  );
  await ds.query(`INSERT INTO mascota (fundacion_id, raza_id, nombre, sexo, edad_meses, tamano, estado_salud, estado, fecha_publicacion)
    SELECT (SELECT id FROM fundacion WHERE nit = 'carga-' || (1 + g % ${FUNDACIONES})),
           (ARRAY(SELECT id FROM raza WHERE nombre IN ('Mestizo', 'Labrador', 'Siamés', 'Persa') ORDER BY id))[1 + g % 4],
           'Mascota ' || g,
           (ARRAY['macho', 'hembra'])[1 + g % 2]::mascota_sexo_enum,
           g % 200,
           (ARRAY['pequeño', 'mediano', 'grande'])[1 + g % 3]::mascota_tamano_enum,
           'Sano',
           (ARRAY['disponible', 'disponible', 'disponible', 'disponible', 'disponible', 'disponible', 'disponible', 'en_proceso', 'adoptada', 'inactiva'])[1 + g % 10]::mascota_estado_enum,
           now() - (g || ' minutes')::interval
      FROM generate_series(1, ${MASCOTAS}) g`);
  await ds.query(`INSERT INTO foto_mascota (mascota_id, url, url_catalogo, es_principal)
    SELECT id, 'publico/mascotas/' || gen_random_uuid() || '.jpg', 'publico/mascotas/' || gen_random_uuid() || '.jpg', true
      FROM mascota WHERE id % 10 < 3`);
  for (const tabla of ['mascota', 'foto_mascota', 'fundacion']) await ds.query(`ANALYZE ${tabla}`);
}

/** Un usuario: varias consultas en secuencia, como lo haría una persona explorando el catálogo. */
async function usuario(base: string, numero: number, especies: number[]): Promise<Medicion[]> {
  const ip = `10.${Math.floor(numero / 250)}.${(numero % 250) + 1}.7`;
  const mediciones: Medicion[] = [];
  const pedir = async (ruta: string): Promise<unknown> => {
    const inicio = performance.now();
    let estado = 0;
    let cuerpo: unknown = null;
    try {
      const res = await fetch(`${base}${ruta}`, { headers: { 'X-Forwarded-For': ip } });
      estado = res.status;
      cuerpo = await res.json();
    } catch {
      estado = 0;
    }
    mediciones.push({ ms: performance.now() - inicio, estado, ruta });
    return cuerpo;
  };
  const ciudades = ['Bogotá', 'Medellín', 'Cali', 'Montería', 'Cartagena'];
  const tamanos = ['pequeño', 'mediano', 'grande'];
  const primera = (await pedir('/mascotas?page=1&limit=12')) as { data?: { id: number }[] } | null;
  await pedir(`/mascotas?page=${1 + (numero % 50)}&limit=12`);
  await pedir(
    `/mascotas?especieId=${especies[numero % especies.length]}&tamano=${encodeURIComponent(tamanos[numero % 3])}&limit=12`,
  );
  await pedir(`/mascotas?ciudad=${encodeURIComponent(ciudades[numero % 5])}&limit=12`);
  const id = primera?.data?.[numero % Math.max(primera.data.length, 1)]?.id ?? 1;
  await pedir(`/mascotas/${id}`);
  return mediciones;
}

const percentil = (ordenados: number[], p: number): number =>
  ordenados[Math.min(ordenados.length - 1, Math.floor((p / 100) * ordenados.length))];

async function main(): Promise<number> {
  let app: NestExpressApplication | undefined;
  let uploads: string | undefined;
  let base = process.env.CARGA_URL;
  let ds: DataSource | undefined;
  const externa = base !== undefined;

  try {
    if (!externa) {
      process.stdout.write(`Preparando ${MASCOTAS} mascotas en ${NOMBRE_BD_PRUEBA}…\n`);
      await recrearBaseDePrueba();
      ds = await crearDataSource();
      await ds.runMigrations();
      await ds.transaction((m) =>
        sembrarBase(m, {
          adminEmail: 'admin@pethogar.local',
          adminPassword: 'clave-admin-carga-larga',
          adminTelefono: '3000000000',
          demo: false,
          demoPassword: '',
        }),
      );
      await cargarDatos(ds);

      uploads = mkdtempSync(path.join(tmpdir(), 'pethogar-carga-'));
      Object.assign(process.env, {
        PORT: '3999',
        NODE_ENV: 'test',
        DATABASE_HOST: conexion.host,
        DATABASE_PORT: String(conexion.port),
        DATABASE_USER: conexion.user,
        DATABASE_PASSWORD: conexion.password,
        DATABASE_NAME: NOMBRE_BD_PRUEBA,
        JWT_ACCESS_SECRET: 'carga-access-secret-de-prueba-0123456789abcdef',
        JWT_REFRESH_SECRET: 'carga-refresh-secret-de-prueba-0123456789abcdef',
        SMTP_HOST: process.env.SMTP_HOST ?? 'localhost',
        SMTP_PORT: process.env.SMTP_PORT ?? '1025',
        SMTP_FROM: 'PetHogar <no-reply@pethogar.local>',
        UPLOADS_DIR: uploads,
        FRONTEND_URL: 'http://localhost:3000',
        TRUST_PROXY: '1',
        SEGUIMIENTOS_CRON_HABILITADO: 'false',
      });
      // La validación del entorno se ejecuta al cargar AppModule: se importa tras fijarlo.
      const { AppModule } = await import('../../src/app.module');
      app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error'] });
      configurarApp(app);
      await app.listen(0, '127.0.0.1');
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api`;
    }

    const especies = (await (
      await fetch(`${base}/especies`, { headers: { 'X-Forwarded-For': '10.99.0.1' } })
    ).json()) as { id: number }[];
    if (especies.length === 0) throw new Error('El catálogo de especies está vacío');
    process.stdout.write(`${USUARIOS} usuarios simulados contra ${base}…\n`);
    const inicio = performance.now();
    const todas = (
      await Promise.all(
        Array.from({ length: USUARIOS }, (_, i) =>
          usuario(
            base as string,
            i,
            especies.map((e) => e.id),
          ),
        ),
      )
    ).flat();
    const duracion = performance.now() - inicio;

    const tiempos = todas.map((m) => m.ms).sort((a, b) => a - b);
    const promedio = tiempos.reduce((t, x) => t + x, 0) / tiempos.length;
    const errores = todas.filter((m) => m.estado !== 200);
    const resumen = {
      usuarios: USUARIOS,
      consultas: todas.length,
      esperadas: USUARIOS * CONSULTAS_POR_USUARIO,
      errores: errores.length,
      promedioMs: Math.round(promedio),
      p50Ms: Math.round(percentil(tiempos, 50)),
      p95Ms: Math.round(percentil(tiempos, 95)),
      maxMs: Math.round(tiempos[tiempos.length - 1]),
      duracionTotalMs: Math.round(duracion),
      umbralMs: UMBRAL_MS,
    };
    process.stdout.write(`[V16] ${JSON.stringify(resumen)}\n`);
    if (errores.length > 0) {
      const porEstado = new Map<number, number>();
      for (const m of errores) porEstado.set(m.estado, (porEstado.get(m.estado) ?? 0) + 1);
      process.stderr.write(
        `Respuestas no exitosas por estado: ${JSON.stringify([...porEstado])}\n`,
      );
      return 1;
    }
    if (resumen.consultas !== resumen.esperadas) return 1;
    if (promedio >= UMBRAL_MS) {
      process.stderr.write(
        `El promedio (${resumen.promedioMs} ms) supera el umbral de ${UMBRAL_MS} ms\n`,
      );
      return 1;
    }
    return 0;
  } finally {
    await app?.close();
    await ds?.destroy().catch(() => undefined);
    if (!externa) await borrarBaseDePrueba().catch(() => undefined);
    if (uploads) rmSync(uploads, { recursive: true, force: true });
  }
}

main()
  .then((codigo) => process.exit(codigo))
  .catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    process.exit(1);
  });
