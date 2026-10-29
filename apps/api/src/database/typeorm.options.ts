import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import type { EnvironmentVariables } from '../config/env.validation';
import { SnakeNamingStrategy } from './snake-naming.strategy';

/** Opciones de Postgres compartidas por Nest y por la CLI de migraciones. */
export function crearOpcionesTypeOrm(
  env: Pick<
    EnvironmentVariables,
    'DATABASE_HOST' | 'DATABASE_PORT' | 'DATABASE_USER' | 'DATABASE_PASSWORD' | 'DATABASE_NAME'
  >,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT,
    username: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,
    synchronize: false,
    migrationsRun: false,
    namingStrategy: new SnakeNamingStrategy(),
    entities: [join(__dirname, '..', 'modules', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  };
}
