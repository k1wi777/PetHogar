import { describe, expect, it } from 'vitest';
import { ErrorApi, MENSAJES } from '@/shared/api/errores';
import { MENSAJE_LIMITE, describirError, mensajeDe } from './errores-usuario';

const http = (estado: number, mensaje: string) => new ErrorApi({ tipo: 'http', estado, mensaje });

describe('describirError', () => {
  it('traduce la red, la sesión vencida y la respuesta inválida', () => {
    expect(describirError(new ErrorApi({ tipo: 'red', mensaje: 'Failed to fetch' }))).toEqual({
      mensaje: MENSAJES.red,
      causa: 'red',
    });
    expect(
      describirError(new ErrorApi({ tipo: 'sesion-vencida', estado: 401, mensaje: 'x' })).causa,
    ).toBe('sesion');
    expect(
      describirError(new ErrorApi({ tipo: 'respuesta-invalida', estado: 200, mensaje: '' }))
        .mensaje,
    ).toBe(MENSAJES.respuestaInvalida);
  });

  it('el 429 usa el texto del servidor si es legible y, si no, el de límite', () => {
    expect(describirError(http(429, 'ThrottlerException: Too Many Requests'))).toEqual({
      mensaje: MENSAJE_LIMITE,
      causa: 'limite',
    });
    expect(describirError(http(429, 'Demasiadas descargas, espera un minuto')).mensaje).toBe(
      'Demasiadas descargas, espera un minuto',
    );
  });

  it('los 5xx nunca muestran el cuerpo del servidor', () => {
    const r = describirError(http(502, '<html>Bad Gateway</html>'));
    expect(r).toEqual({ mensaje: MENSAJES.servidor, causa: 'servidor' });
  });

  it('un 4xx de negocio conserva el mensaje en español del servidor', () => {
    expect(describirError(http(409, 'La solicitud ya fue respondida'))).toEqual({
      mensaje: 'La solicitud ya fue respondida',
      causa: 'solicitud',
    });
  });

  it('un 4xx con texto técnico o vacío usa un texto propio según el estado', () => {
    expect(describirError(http(403, 'Forbidden resource')).causa).toBe('permiso');
    expect(describirError(http(403, 'Forbidden resource')).mensaje).not.toMatch(/forbidden/i);
    expect(describirError(http(404, 'Cannot GET /x')).causa).toBe('no-encontrado');
    expect(describirError(http(401, 'Unauthorized')).mensaje).toBe(MENSAJES.sesionVencida);
    expect(describirError(http(400, '{"statusCode":400}')).mensaje).toBe(MENSAJES.generico);
  });

  it('un error que no es de la API es genérico y no filtra su texto', () => {
    expect(describirError(new TypeError('x is undefined'))).toEqual({
      mensaje: MENSAJES.generico,
      causa: 'desconocida',
    });
    expect(mensajeDe('Failed to fetch')).toBe(MENSAJES.generico);
  });
});
