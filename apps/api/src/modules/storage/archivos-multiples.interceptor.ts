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
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Observable } from 'rxjs';
import { MAX_BYTES, MENSAJE_ARCHIVO_GRANDE } from './storage.constants';

/**
 * Subida de hasta `maximo` archivos en memoria bajo un mismo campo, con el tope de tamaño por
 * archivo del almacenamiento y los errores de multer traducidos al español.
 */
export function ArchivosMultiplesInterceptor(campo: string, maximo: number): Type<NestInterceptor> {
  const Base = FilesInterceptor(campo, maximo, {
    limits: { fileSize: MAX_BYTES, files: maximo },
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
        throw traducir(error, campo, maximo);
      }
    }
  }
  return mixin(Interceptor);
}

function traducir(error: unknown, campo: string, maximo: number): Error {
  if (error instanceof PayloadTooLargeException) {
    return new PayloadTooLargeException(MENSAJE_ARCHIVO_GRANDE);
  }
  if (error instanceof BadRequestException) {
    if (/unexpected (file )?field|too many files/i.test(error.message)) {
      return new BadRequestException(
        `Las fotos van en el campo "${campo}" y no pueden ser más de ${maximo}`,
      );
    }
    return new BadRequestException('No se pudo leer el archivo enviado');
  }
  return error instanceof Error ? error : new BadRequestException('No se pudo leer el archivo');
}
