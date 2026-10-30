import { describe, expect, it } from 'vitest';
import { rutaDeEnlace } from './enlaces';

describe('rutaDeEnlace', () => {
  it('recorta el prefijo /api', () => {
    expect(rutaDeEnlace('/api/fundacion/solicitudes/3/formulario')).toBe(
      '/fundacion/solicitudes/3/formulario',
    );
    expect(rutaDeEnlace('/api/fundacion/seguimientos/4/evidencias/9')).toBe(
      '/fundacion/seguimientos/4/evidencias/9',
    );
  });
  it.each([
    'https://evil.test/api/x',
    '//evil.test/api/x',
    '/otra/ruta',
    '/api/../auth/login',
    '/api/',
    '/api',
    'api/x',
    '/api/x?token=1',
    '/api//x',
    '/api/x\\y',
    '',
  ])('rechaza %j', (url) => {
    expect(() => rutaDeEnlace(url)).toThrow(/enlace recibido no es válido/);
  });
});
