import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as bcrypt from 'bcryptjs';
import { DataSource, type EntityManager } from 'typeorm';
import { validate } from '../../config/env.validation';
import { crearOpcionesTypeOrm } from '../typeorm.options';
import { RAZAS_POR_ESPECIE, ROLES } from './catalogos.data';
import { COSTE_BCRYPT, leerSeedConfig, type SeedConfig } from './seed.config';
import { sembrarDemo } from './seed.demo';

export type Registro = (mensaje: string) => void;

/** Roles, especies, razas y administrador. Idempotente: no toca un administrador existente. */
export async function sembrarBase(
  manager: EntityManager,
  config: SeedConfig,
  log: Registro = () => undefined,
): Promise<void> {
  for (const rol of ROLES) {
    await manager.query(
      'INSERT INTO "rol" ("nombre") VALUES ($1) ON CONFLICT ("nombre") DO NOTHING',
      [rol],
    );
  }
  for (const [especie, razas] of Object.entries(RAZAS_POR_ESPECIE)) {
    await manager.query(
      'INSERT INTO "especie" ("nombre") VALUES ($1) ON CONFLICT ("nombre") DO NOTHING',
      [especie],
    );
    for (const raza of razas) {
      await manager.query(
        `INSERT INTO "raza" ("especie_id", "nombre")
         SELECT "id", $2 FROM "especie" WHERE "nombre" = $1
         ON CONFLICT ("especie_id", "nombre") DO NOTHING`,
        [especie, raza],
      );
    }
  }
  log('Catálogos base listos (roles, especies y razas).');

  const existente: unknown[] = await manager.query(
    'SELECT "id" FROM "usuario" WHERE "email" = $1',
    [config.adminEmail],
  );
  if (existente.length > 0) {
    log(`El administrador ${config.adminEmail} ya existía: no se modifica.`);
    return;
  }
  const hash = await bcrypt.hash(config.adminPassword, COSTE_BCRYPT);
  await manager.query(
    `INSERT INTO "usuario" ("rol_id", "email", "contrasena", "telefono", "activo",
       "email_verificado", "acepta_politica_datos", "fecha_aceptacion")
     SELECT "id", $1, $2, $3, true, true, true, now() FROM "rol" WHERE "nombre" = 'administrador'`,
    [config.adminEmail, hash, config.adminTelefono],
  );
  log(`Administrador ${config.adminEmail} creado.`);
}

async function main(): Promise<void> {
  const archivoEnv = join(__dirname, '..', '..', '..', '.env');
  if (existsSync(archivoEnv)) {
    process.loadEnvFile(archivoEnv);
  }
  // Valida antes de abrir la base: si falta algo no se escribe nada.
  const config = leerSeedConfig(process.env, process.argv.slice(2));
  const dataSource = new DataSource(crearOpcionesTypeOrm(validate(process.env)));
  await dataSource.initialize();
  try {
    await dataSource.transaction(async (manager) => {
      await sembrarBase(manager, config, console.log);
      if (config.demo) {
        await sembrarDemo(manager, config, console.log);
      }
    });
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
