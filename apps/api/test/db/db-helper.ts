import 'reflect-metadata';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { DataSource } from 'typeorm';
import { crearOpcionesTypeOrm } from '../../src/database/typeorm.options';

// Jest aísla `process`: se lee apps/api/.env sin modificar el entorno; las variables ya definidas ganan.
const archivoEnv = join(__dirname, '..', '..', '.env');
const env: Record<string, string | undefined> = {
  ...(existsSync(archivoEnv) ? parseEnv(readFileSync(archivoEnv, 'utf8')) : {}),
  ...process.env,
};

export const conexion = {
  host: env.DATABASE_HOST ?? 'localhost',
  port: Number(env.DATABASE_PORT ?? 5432),
  user: env.DATABASE_USER ?? 'pethogar',
  password: env.DATABASE_PASSWORD ?? 'pethogar',
};

/** Base dedicada a las pruebas: nunca toca la de desarrollo. */
export const NOMBRE_BD_PRUEBA = `${env.DATABASE_NAME ?? 'pethogar'}_test`;

async function conAdmin(sql: string): Promise<void> {
  const admin = new DataSource({
    type: 'postgres',
    ...conexion,
    username: conexion.user,
    database: 'postgres',
  });
  await admin.initialize();
  try {
    await admin.query(sql);
  } finally {
    await admin.destroy();
  }
}

export async function recrearBaseDePrueba(): Promise<void> {
  await conAdmin(`DROP DATABASE IF EXISTS "${NOMBRE_BD_PRUEBA}" WITH (FORCE)`);
  await conAdmin(`CREATE DATABASE "${NOMBRE_BD_PRUEBA}"`);
}

export async function borrarBaseDePrueba(): Promise<void> {
  await conAdmin(`DROP DATABASE IF EXISTS "${NOMBRE_BD_PRUEBA}" WITH (FORCE)`);
}

/** DataSource con las mismas entidades y migraciones que la aplicación, sobre la base de prueba. */
export async function crearDataSource(): Promise<DataSource> {
  const ds = new DataSource(
    crearOpcionesTypeOrm({
      DATABASE_HOST: conexion.host,
      DATABASE_PORT: conexion.port,
      DATABASE_USER: conexion.user,
      DATABASE_PASSWORD: conexion.password,
      DATABASE_NAME: NOMBRE_BD_PRUEBA,
    }),
  );
  await ds.initialize();
  return ds;
}

export async function contar(ds: DataSource, sql: string): Promise<number> {
  const filas: { n: string }[] = await ds.query(sql);
  return Number(filas[0].n);
}
