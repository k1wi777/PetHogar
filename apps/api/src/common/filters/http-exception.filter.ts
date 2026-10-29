import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

const MENSAJES_POR_ESTADO: Record<number, string> = {
  400: 'Solicitud incorrecta',
  401: 'No autenticado',
  403: 'No tienes permiso para realizar esta acción',
  404: 'Recurso no encontrado',
  405: 'Método no permitido',
  409: 'Conflicto con el estado actual del recurso',
  413: 'El contenido enviado es demasiado grande',
  422: 'No se pudo procesar la solicitud',
  429: 'Demasiadas solicitudes, inténtalo de nuevo más tarde',
  500: 'Error interno del servidor',
};

const MENSAJE_GENERICO = 'Error interno del servidor';

export interface CuerpoError {
  statusCode: number;
  error: string;
  message: string;
  errores?: unknown;
  path: string;
  timestamp: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const cuerpo = this.construirCuerpo(exception, request.url);

    if (cuerpo.statusCode >= 500) {
      const traza = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`${request.method} ${request.url} -> ${cuerpo.statusCode}`, traza);
    }

    response.status(cuerpo.statusCode).json(cuerpo);
  }

  private construirCuerpo(exception: unknown, path: string): CuerpoError {
    const timestamp = new Date().toISOString();

    if (!(exception instanceof HttpException)) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: MENSAJE_GENERICO,
        path,
        timestamp,
      };
    }

    const statusCode = exception.getStatus();
    const respuesta = exception.getResponse();
    const error = exception.name.replace(/Exception$/, '') || 'Error';
    let message = MENSAJES_POR_ESTADO[statusCode] ?? 'Error en la solicitud';
    let errores: unknown;

    if (typeof respuesta === 'string') {
      message = this.esMensajePorDefecto(respuesta, exception) ? message : respuesta;
    } else if (respuesta && typeof respuesta === 'object') {
      const detalle = respuesta as { message?: unknown; errores?: unknown };
      errores = detalle.errores;
      if (
        typeof detalle.message === 'string' &&
        !this.esMensajePorDefecto(detalle.message, exception)
      ) {
        message = detalle.message;
      }
    }

    return { statusCode, error, message, ...(errores ? { errores } : {}), path, timestamp };
  }

  /** Los mensajes por defecto de Nest están en inglés; se sustituyen por los traducidos. */
  private esMensajePorDefecto(mensaje: string, exception: HttpException): boolean {
    const nombre = exception.name;
    const porDefecto = new Set<string>([
      nombre,
      nombre.replace(/Exception$/, '').replace(/([a-z])([A-Z])/g, '$1 $2'),
      'Bad Request',
      'Unauthorized',
      'Forbidden',
      'Not Found',
      'Conflict',
      'Method Not Allowed',
      'Payload Too Large',
      'Unprocessable Entity',
      'Internal Server Error',
    ]);
    return (
      porDefecto.has(mensaje) ||
      /^(Cannot (GET|POST|PUT|PATCH|DELETE)|ThrottlerException)/.test(mensaje)
    );
  }
}
