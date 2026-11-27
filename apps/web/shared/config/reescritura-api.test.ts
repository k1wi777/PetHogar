import { describe, expect, it } from 'vitest';
import { reescriturasApi } from './reescritura-api';

describe('reescriturasApi', () => {
  it.each([
    {},
    { API_PROXY_DESTINO: '' },
    { NEXT_PUBLIC_API_URL: '' },
    { NEXT_PUBLIC_API_URL: 'http://localhost:3001/api' },
    { NEXT_PUBLIC_API_URL: 'https://api.example.com/api' },
  ])('sin destino no reenvía nada: %o', (env) => {
    expect(reescriturasApi(env)).toEqual([]);
  });

  it.each([
    'https://api.example.com/api',
    'https://api.example.com/api/',
    'https://api.example.com/api//',
  ])('reenvía /api al destino %s sin barra final duplicada', (destino) => {
    expect(reescriturasApi({ API_PROXY_DESTINO: destino, NEXT_PUBLIC_API_URL: '/api' })).toEqual([
      { source: '/api/:path*', destination: 'https://api.example.com/api/:path*' },
    ]);
  });

  it('admite un destino HTTP con puerto', () => {
    const [regla] = reescriturasApi({
      API_PROXY_DESTINO: 'http://localhost:3001/api',
      NEXT_PUBLIC_API_URL: '/api',
    });
    expect(regla?.destination).toBe('http://localhost:3001/api/:path*');
  });

  it.each(['/api', 'api.example.com/api', 'ftp://api.example.com/api', 'https:/api', 'https://'])(
    'rechaza el destino %s',
    (destino) => {
      expect(() =>
        reescriturasApi({ API_PROXY_DESTINO: destino, NEXT_PUBLIC_API_URL: '/api' }),
      ).toThrow('API_PROXY_DESTINO: debe ser una URL HTTP(S) absoluta');
    },
  );

  it.each([undefined, '', 'https://api.example.com/api', '/otra'])(
    'con proxy exige que la URL pública sea /api (recibe %s)',
    (publica) => {
      expect(() =>
        reescriturasApi({
          API_PROXY_DESTINO: 'https://api.example.com/api',
          NEXT_PUBLIC_API_URL: publica,
        }),
      ).toThrow('NEXT_PUBLIC_API_URL: con API_PROXY_DESTINO configurado debe valer /api');
    },
  );

  it.each(['/api', 'api', '//api.example.com/api'])(
    'sin proxy rechaza la URL pública relativa %s',
    (publica) => {
      expect(() => reescriturasApi({ NEXT_PUBLIC_API_URL: publica })).toThrow(
        'NEXT_PUBLIC_API_URL: no puede ser una ruta relativa sin proxy',
      );
    },
  );
});
