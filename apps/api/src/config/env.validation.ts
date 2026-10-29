import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { CronTime } from 'cron';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MinLength,
  Min,
  validateSync,
  ValidateBy,
} from 'class-validator';

const MENSAJE_TEXTO = 'debe ser un texto no vacío';
const MENSAJE_BOOLEANO = "debe ser 'true' o 'false'";
const MENSAJE_PUERTO = 'debe ser un número de puerto entre 1 y 65535';
const MENSAJE_ENTERO_POSITIVO = 'debe ser un número entero mayor o igual a 1';
const MENSAJE_SECRETO = 'debe tener al menos 32 caracteres';
const LONGITUD_MINIMA_SECRETO = 32;
const MENSAJE_CRON = 'debe ser una expresión cron válida de 5 campos (p. ej. 10 0 * * *)';
const MENSAJE_DIAS_RECORDATORIO = 'debe ser un número entero entre 1 y 30';

/** Expresión cron de exactamente 5 campos (minuto a día de la semana) que la librería acepta. */
export function esExpresionCron(valor: unknown): boolean {
  if (typeof valor !== 'string' || valor.trim().split(/\s+/).length !== 5) return false;
  try {
    new CronTime(valor.trim());
    return true;
  } catch {
    return false;
  }
}

const EsExpresionCron = (): PropertyDecorator =>
  ValidateBy({
    name: 'esExpresionCron',
    validator: { validate: esExpresionCron, defaultMessage: () => MENSAJE_CRON },
  });
/** Fragmento común de los secretos de ejemplo de `.env.example`. */
const MARCA_SECRETO_EJEMPLO = 'cambiar-en-produccion';

export class EnvironmentVariables {
  @IsInt({ message: MENSAJE_PUERTO })
  @Min(1, { message: MENSAJE_PUERTO })
  @Max(65535, { message: MENSAJE_PUERTO })
  PORT!: number;

  @IsString({ message: MENSAJE_TEXTO })
  @IsNotEmpty({ message: MENSAJE_TEXTO })
  DATABASE_HOST!: string;

  @IsInt({ message: MENSAJE_PUERTO })
  @Min(1, { message: MENSAJE_PUERTO })
  @Max(65535, { message: MENSAJE_PUERTO })
  DATABASE_PORT!: number;

  @IsString({ message: MENSAJE_TEXTO })
  @IsNotEmpty({ message: MENSAJE_TEXTO })
  DATABASE_USER!: string;

  @IsString({ message: MENSAJE_TEXTO })
  @IsNotEmpty({ message: MENSAJE_TEXTO })
  DATABASE_PASSWORD!: string;

  @IsString({ message: MENSAJE_TEXTO })
  @IsNotEmpty({ message: MENSAJE_TEXTO })
  DATABASE_NAME!: string;

  @IsString({ message: MENSAJE_TEXTO })
  @MinLength(LONGITUD_MINIMA_SECRETO, { message: MENSAJE_SECRETO })
  JWT_ACCESS_SECRET!: string;

  @IsString({ message: MENSAJE_TEXTO })
  @MinLength(LONGITUD_MINIMA_SECRETO, { message: MENSAJE_SECRETO })
  JWT_REFRESH_SECRET!: string;

  @IsString({ message: MENSAJE_TEXTO })
  @IsNotEmpty({ message: MENSAJE_TEXTO })
  SMTP_HOST!: string;

  @IsInt({ message: MENSAJE_PUERTO })
  @Min(1, { message: MENSAJE_PUERTO })
  @Max(65535, { message: MENSAJE_PUERTO })
  SMTP_PORT!: number;

  @IsString({ message: MENSAJE_TEXTO })
  @IsNotEmpty({ message: MENSAJE_TEXTO })
  SMTP_FROM!: string;

  @IsString({ message: MENSAJE_TEXTO })
  @IsNotEmpty({ message: MENSAJE_TEXTO })
  UPLOADS_DIR!: string;

  @IsUrl(
    { require_tld: false, require_protocol: true },
    { message: 'debe ser una URL válida (p. ej. http://localhost:3000)' },
  )
  FRONTEND_URL!: string;

  @IsOptional()
  @IsString({ message: MENSAJE_TEXTO })
  SMTP_USER?: string;

  @IsOptional()
  @IsString({ message: MENSAJE_TEXTO })
  SMTP_PASSWORD?: string;

  @IsOptional()
  @IsIn(['true', 'false'], { message: MENSAJE_BOOLEANO })
  SMTP_SECURE?: string;

  @IsOptional()
  @IsUrl(
    { require_tld: false, require_protocol: true },
    { message: 'debe ser una URL válida (p. ej. http://localhost:3001)' },
  )
  API_PUBLIC_URL?: string;

  @IsOptional()
  @IsString({ message: MENSAJE_TEXTO })
  NODE_ENV?: string;

  @IsInt({ message: MENSAJE_ENTERO_POSITIVO })
  @Min(1, { message: MENSAJE_ENTERO_POSITIVO })
  JWT_ACCESS_EXPIRES_MIN: number = 15;

  @IsInt({ message: MENSAJE_ENTERO_POSITIVO })
  @Min(1, { message: MENSAJE_ENTERO_POSITIVO })
  JWT_REFRESH_EXPIRES_DAYS: number = 7;

  @IsInt({ message: MENSAJE_ENTERO_POSITIVO })
  @Min(1, { message: MENSAJE_ENTERO_POSITIVO })
  LOGIN_MAX_INTENTOS: number = 5;

  @IsInt({ message: MENSAJE_ENTERO_POSITIVO })
  @Min(1, { message: MENSAJE_ENTERO_POSITIVO })
  LOGIN_BLOQUEO_MIN: number = 15;

  @IsInt({ message: MENSAJE_ENTERO_POSITIVO })
  @Min(1, { message: MENSAJE_ENTERO_POSITIVO })
  VERIFICACION_EXPIRA_HORAS: number = 24;

  @IsInt({ message: MENSAJE_ENTERO_POSITIVO })
  @Min(1, { message: MENSAJE_ENTERO_POSITIVO })
  RESET_CODE_EXPIRA_MIN: number = 15;

  @IsInt({ message: MENSAJE_ENTERO_POSITIVO })
  @Min(1, { message: MENSAJE_ENTERO_POSITIVO })
  RESET_CODE_MAX_INTENTOS: number = 5;

  /** Tareas programadas de seguimientos; con `false` no se crea ningún temporizador. */
  @IsOptional()
  @IsIn(['true', 'false'], { message: MENSAJE_BOOLEANO })
  SEGUIMIENTOS_CRON_HABILITADO: string = 'true';

  /** Marca como vencidos los seguimientos con fecha pasada (hora de Bogotá). */
  @EsExpresionCron()
  SEGUIMIENTOS_CRON_VENCIDOS: string = '10 0 * * *';

  @EsExpresionCron()
  SEGUIMIENTOS_CRON_RECORDATORIOS: string = '0 7 * * *';

  /** Días de antelación con los que se avisa de un seguimiento que vence pronto. */
  @IsInt({ message: MENSAJE_DIAS_RECORDATORIO })
  @Min(1, { message: MENSAJE_DIAS_RECORDATORIO })
  @Max(30, { message: MENSAJE_DIAS_RECORDATORIO })
  SEGUIMIENTOS_RECORDATORIO_DIAS: number = 3;

  /** Por defecto `true` solo en producción (ver `cookieSegura`). */
  @IsOptional()
  @IsIn(['true', 'false'], { message: MENSAJE_BOOLEANO })
  COOKIE_SECURE?: string;
}

/** Atributo `Secure` de la cookie de refresh: explícito o, por defecto, solo en producción. */
export function cookieSegura(
  env: Pick<EnvironmentVariables, 'COOKIE_SECURE' | 'NODE_ENV'>,
): boolean {
  return env.COOKIE_SECURE === undefined
    ? env.NODE_ENV === 'production'
    : esVerdadero(env.COOKIE_SECURE);
}

/**
 * Los booleanos se leen como cadena: con `enableImplicitConversion` la cadena 'false'
 * se convertiría en `true`.
 */
export function esVerdadero(valor: string | undefined): boolean {
  return valor === 'true';
}

/** Valida y convierte las variables de entorno; aborta el arranque si alguna falla. */
export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const instancia = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errores = validateSync(instancia, { skipMissingProperties: false });

  if (errores.length > 0) {
    const detalle = errores
      .map((error) => {
        const mensajes = Object.values(error.constraints ?? {});
        const motivo = config[error.property] === undefined ? 'es obligatoria' : mensajes[0];
        return `  - ${error.property}: ${motivo}`;
      })
      .join('\n');
    throw new Error(`Variables de entorno inválidas o ausentes:\n${detalle}`);
  }

  validarSecretos(instancia);
  return instancia;
}

/** Reglas entre variables: secretos distintos y, en producción, distintos de los de ejemplo. */
function validarSecretos(env: EnvironmentVariables): void {
  const problemas: string[] = [];
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    problemas.push('  - JWT_REFRESH_SECRET: debe ser distinto de JWT_ACCESS_SECRET');
  }
  if (env.NODE_ENV === 'production') {
    for (const nombre of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      if (env[nombre].includes(MARCA_SECRETO_EJEMPLO)) {
        problemas.push(`  - ${nombre}: en producción no puede conservar el valor de ejemplo`);
      }
    }
  }
  if (problemas.length > 0) {
    throw new Error(`Variables de entorno inválidas o ausentes:\n${problemas.join('\n')}`);
  }
}
