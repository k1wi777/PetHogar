import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { validate } from '../config/env.validation';
import { crearOpcionesTypeOrm } from './typeorm.options';

// La CLI no pasa por Nest: carga apps/api/.env a mano (Node 24, sin dotenv).
const archivoEnv = join(__dirname, '..', '..', '.env');
if (existsSync(archivoEnv)) {
  process.loadEnvFile(archivoEnv);
}

export default new DataSource(crearOpcionesTypeOrm(validate(process.env)));
