import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from 'class-validator';

const MENSAJE_TEXTO = 'debe ser un texto no vacío';
const MENSAJE_BOOLEANO = "debe ser 'true' o 'false'";
const MENSAJE_PUERTO = 'debe ser un número de puerto entre 1 y 65535';

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
  @IsNotEmpty({ message: MENSAJE_TEXTO })
  JWT_ACCESS_SECRET!: string;

  @IsString({ message: MENSAJE_TEXTO })
  @IsNotEmpty({ message: MENSAJE_TEXTO })
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
  @IsIn(['true', 'false'], { message: MENSAJE_BOOLEANO })
  HABILITAR_ENDPOINTS_PRUEBA?: string;
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

  return instancia;
}
