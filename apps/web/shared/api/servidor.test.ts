import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearClienteServidor, urlApiPublica, urlApiServidor } from './servidor';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('cliente de servidor', () => {
  it('pide con caché de Next, sin credenciales ni token', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: 1 })));
    const cliente = crearClienteServidor({ baseUrl: 'http://api/x', fetchImpl });
    cliente.tokens.guardar('secreto');
    await cliente.get('/mascotas', { autenticada: false, consulta: { page: 2, ciudad: '' } });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(url).toBe('http://api/x/mascotas?page=2');
    expect(init.next).toEqual({ revalidate: 60 });
    expect(init.headers).not.toHaveProperty('Authorization');
    expect(init.credentials).toBe('same-origin');
  });

  it('prefiere API_URL y cae a NEXT_PUBLIC_API_URL', () => {
    vi.stubEnv('API_URL', '');
    vi.stubEnv('API_PROXY_DESTINO', '');
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://publica/api');
    expect(urlApiServidor()).toBe('http://publica/api');
    vi.stubEnv('API_URL', 'http://interna:3001/api');
    expect(urlApiServidor()).toBe('http://interna:3001/api');
    expect(urlApiPublica()).toBe('http://publica/api');
  });

  it('con proxy usa su destino absoluto y no la URL pública relativa', () => {
    vi.stubEnv('API_URL', '');
    vi.stubEnv('API_PROXY_DESTINO', 'https://api.example.com/api');
    vi.stubEnv('NEXT_PUBLIC_API_URL', '/api');
    expect(urlApiServidor()).toBe('https://api.example.com/api');
    expect(urlApiPublica()).toBe('/api');
  });

  it('con proxy, API_URL tiene prioridad', () => {
    vi.stubEnv('API_URL', 'http://interna:3001/api');
    vi.stubEnv('API_PROXY_DESTINO', 'https://api.example.com/api');
    expect(urlApiServidor()).toBe('http://interna:3001/api');
  });

  it('sin ninguna variable usa la URL por defecto', () => {
    vi.stubEnv('API_URL', '');
    vi.stubEnv('API_PROXY_DESTINO', '');
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    expect(urlApiServidor()).toBe('http://localhost:3001/api');
  });
});
