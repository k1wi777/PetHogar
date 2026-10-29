import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  mixin,
  NestInterceptor,
  PayloadTooLargeException,
  Type,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Observable } from 'rxjs';
import { MAX_BYTES, MENSAJE_ARCHIVO_GRANDE } from './storage.constants';

/** Subida de un único archivo en memoria (el almacenamiento por defecto de multer) con mensajes de error en español. */
export function ArchivoUnicoInterceptor(campo: string): Type<NestInterceptor> {
  const Base = FileInterceptor(campo, {
    limits: { fileSize: MAX_BYTES, files: 1 },
  });

  @Injectable()
  class Interceptor extends Base {
    override async intercept(
      context: ExecutionContext,
      next: CallHandler,
    ): Promise<Observable<unknown>> {
      try {
        return await super.intercept(context, next);
      } catch (error) {
        throw traducir(error, campo);
      }
    }
  }
  return mixin(Interceptor);
}

/** Nest ya convierte los errores de multer en excepciones HTTP en inglés; aquí se reescriben. */
function traducir(error: unknown, campo: string): Error {
  if (error instanceof PayloadTooLargeException) {
    return new PayloadTooLargeException(MENSAJE_ARCHIVO_GRANDE);
  }
  if (error instanceof BadRequestException) {
    const mensaje = error.message;
    if (/unexpected field/i.test(mensaje)) {
      return new BadRequestException(`Debes enviar un único archivo en el campo "${campo}"`);
    }
    if (/too many files/i.test(mensaje)) {
      return new BadRequestException('Solo se permite subir un archivo a la vez');
    }
    return new BadRequestException('No se pudo leer el archivo enviado');
  }
  return error instanceof Error ? error : new BadRequestException('No se pudo leer el archivo');
}
