import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  validateSync,
} from 'class-validator';

/** Coste de bcrypt para las contraseñas sembradas. */
export const COSTE_BCRYPT = 12;
export const TELEFONO_ADMIN_POR_DEFECTO = '0000000000';

const MENSAJE_PASSWORD = 'debe tener al menos 10 caracteres';

export class SeedVariables {
  @IsEmail({}, { message: 'debe ser un correo electrónico válido' })
  @MaxLength(100, { message: 'no puede superar los 100 caracteres' })
  SEED_ADMIN_EMAIL!: string;

  @IsString({ message: MENSAJE_PASSWORD })
  @MinLength(10, { message: MENSAJE_PASSWORD })
  @MaxLength(72, { message: 'no puede superar los 72 caracteres (límite de bcrypt)' })
  SEED_ADMIN_PASSWORD!: string;

  @IsOptional()
  @IsString({ message: 'debe ser un texto' })
  @IsNotEmpty({ message: 'no puede estar vacío' })
  @MaxLength(15, { message: 'no puede superar los 15 caracteres' })
  SEED_ADMIN_TELEFONO?: string;

  @IsOptional()
  @IsString({ message: MENSAJE_PASSWORD })
  @MinLength(10, { message: MENSAJE_PASSWORD })
  @MaxLength(72, { message: 'no puede superar los 72 caracteres (límite de bcrypt)' })
  SEED_DEMO_PASSWORD?: string;
}

export interface SeedConfig {
  adminEmail: string;
  adminPassword: string;
  adminTelefono: string;
  demo: boolean;
  demoPassword?: string;
}

/** Valida las variables del seed; lanza un error en español con cada variable defectuosa. */
export function leerSeedConfig(env: Record<string, unknown>, argv: string[] = []): SeedConfig {
  const demo = argv.includes('--demo');
  const instancia = plainToInstance(SeedVariables, env);
  const errores = validateSync(instancia, { skipMissingProperties: false });
  const detalles = errores
    .filter((e) => demo || e.property !== 'SEED_DEMO_PASSWORD')
    .map((e) => {
      const motivo =
        env[e.property] === undefined || env[e.property] === ''
          ? 'es obligatoria'
          : Object.values(e.constraints ?? {})[0];
      return `  - ${e.property}: ${motivo}`;
    });
  if (demo && !instancia.SEED_DEMO_PASSWORD && !detalles.some((d) => d.includes('SEED_DEMO'))) {
    detalles.push('  - SEED_DEMO_PASSWORD: es obligatoria con --demo');
  }
  if (detalles.length > 0) {
    throw new Error(`Variables del seed inválidas o ausentes:\n${detalles.join('\n')}`);
  }
  return {
    adminEmail: instancia.SEED_ADMIN_EMAIL,
    adminPassword: instancia.SEED_ADMIN_PASSWORD,
    adminTelefono: instancia.SEED_ADMIN_TELEFONO || TELEFONO_ADMIN_POR_DEFECTO,
    demo,
    demoPassword: instancia.SEED_DEMO_PASSWORD,
  };
}
