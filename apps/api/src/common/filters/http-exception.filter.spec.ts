import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { AllExceptionsFilter, CuerpoError } from './http-exception.filter';

function ejecutar(excepcion: unknown): { status: number; cuerpo: CuerpoError } {
  const salida = { status: 0, cuerpo: undefined as unknown as CuerpoError };
  const response = {
    status: (codigo: number) => {
      salida.status = codigo;
      return { json: (cuerpo: CuerpoError) => (salida.cuerpo = cuerpo) };
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url: '/api/prueba', method: 'GET' }),
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter().catch(excepcion, host);
  return salida;
}

describe('AllExceptionsFilter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('conserva el mensaje propio de una HttpException', () => {
    const { status, cuerpo } = ejecutar(new NotFoundException('La mascota no existe'));
    expect(status).toBe(404);
    expect(cuerpo).toMatchObject({
      statusCode: 404,
      message: 'La mascota no existe',
      path: '/api/prueba',
    });
    expect(cuerpo.timestamp).toBeDefined();
  });

  it('traduce el mensaje por defecto de Nest', () => {
    expect(ejecutar(new UnauthorizedException()).cuerpo.message).toBe('No autenticado');
    expect(ejecutar(new NotFoundException()).cuerpo.message).toBe('Recurso no encontrado');
  });

  it('responde 429 en español cuando se supera el límite', () => {
    const { status, cuerpo } = ejecutar(new ThrottlerException());
    expect(status).toBe(429);
    expect(cuerpo.message).toBe('Demasiadas solicitudes, inténtalo de nuevo más tarde');
  });

  it('incluye los errores por campo de validación', () => {
    const errores = [{ campo: 'nombre', mensajes: ['El nombre es obligatorio'] }];
    const { status, cuerpo } = ejecutar(
      new BadRequestException({ message: 'Los datos enviados no son válidos', errores }),
    );
    expect(status).toBe(400);
    expect(cuerpo.errores).toEqual(errores);
    expect(cuerpo.message).toBe('Los datos enviados no son válidos');
  });

  it('responde 500 genérico sin detalles internos y registra el error', () => {
    const { status, cuerpo } = ejecutar(new Error('fallo secreto de la BD'));
    expect(status).toBe(500);
    expect(cuerpo.message).toBe('Error interno del servidor');
    expect(JSON.stringify(cuerpo)).not.toContain('secreto');
    expect(Logger.prototype.error).toHaveBeenCalled();
  });
});
