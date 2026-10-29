import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';

export interface ErrorCampo {
  campo: string;
  mensajes: string[];
}

function aplanar(errores: ValidationError[], prefijo = ''): ErrorCampo[] {
  return errores.flatMap((error) => {
    const campo = prefijo ? `${prefijo}.${error.property}` : error.property;
    const propios = error.constraints
      ? [{ campo, mensajes: Object.values(error.constraints) }]
      : [];
    return [...propios, ...aplanar(error.children ?? [], campo)];
  });
}

/** ValidationPipe global: descarta propiedades no declaradas y agrupa los errores por campo. */
export function crearValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: false,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    exceptionFactory: (errores) =>
      new BadRequestException({
        message: 'Los datos enviados no son válidos',
        errores: aplanar(errores),
      }),
  });
}
