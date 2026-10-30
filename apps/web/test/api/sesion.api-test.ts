import { beforeAll, describe, expect, it } from 'vitest';
import { crearClienteHttp } from '@/shared/api/cliente';
import type { RespuestaSesion, Usuario } from '@/shared/api/tipos';
import { crearFetchConCookies } from './cookies';
import { conLimite } from './limite';

const API = process.env.TEST_API_URL;
const ORIGEN = process.env.TEST_WEB_ORIGIN ?? 'http://localhost:3000';
const EMAIL = process.env.TEST_DEMO_EMAIL ?? 'fundacion.demo@pethogar.local';
const CLAVE = process.env.TEST_DEMO_PASSWORD;

function nuevoCliente() {
  const jar = crearFetchConCookies(ORIGEN);
  const cliente = crearClienteHttp({ baseUrl: API!, fetchImpl: jar.fetchImpl, cerrojos: null });
  return { jar, cliente };
}

describe('V17: sesión del front contra la API real', () => {
  beforeAll(() => {
    if (!API || !CLAVE) {
      throw new Error(
        'Define TEST_API_URL y TEST_DEMO_PASSWORD (API real con seed:demo). Ver verification.md (V17).',
      );
    }
  });

  it('el preflight CORS desde el origen de la web permite credenciales', async () => {
    const r = await fetch(`${API}/auth/refresh`, {
      method: 'OPTIONS',
      headers: {
        Origin: ORIGEN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,authorization',
      },
    });
    expect(r.status).toBeLessThan(300);
    expect(r.headers.get('access-control-allow-origin')).toBe(ORIGEN);
    expect(r.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('un origen ajeno no recibe permiso CORS', async () => {
    const r = await fetch(`${API}/auth/refresh`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://evil.example', 'Access-Control-Request-Method': 'POST' },
    });
    expect(r.headers.get('access-control-allow-origin')).not.toBe('http://evil.example');
  });

  it('login, cookie de refresh, /auth/me, contador, refresh concurrente y logout', async () => {
    const { jar, cliente } = nuevoCliente();

    // Inicio de sesión (el cuerpo trae el token; el refresh queda en la cookie).
    const sesion = await conLimite(() =>
      cliente.post<RespuestaSesion>('/auth/login', {
        autenticada: false,
        cuerpo: { email: EMAIL, contrasena: CLAVE },
      }),
    );
    cliente.tokens.guardar(sesion.accessToken);
    expect(sesion.usuario.rol).toBe('fundacion');

    const cookie = jar.setCookiesCrudos.find((c) => c.startsWith('refresh_token='));
    expect(cookie, 'login debe enviar Set-Cookie refresh_token').toBeDefined();
    expect(cookie).toMatch(/;\s*HttpOnly/i);
    expect(cookie).toMatch(/;\s*SameSite=Lax/i);
    expect(cookie).toMatch(/;\s*Path=\/api\/auth(;|$)/i);

    // Perfil con rol y estado de la fundación.
    const yo = await cliente.get<Usuario>('/auth/me');
    expect(yo.rol).toBe('fundacion');
    expect(yo.fundacion?.estadoValidacion).toBe('aprobada');

    // Contador numérico.
    const contador = await cliente.get<{ noLeidas: number }>('/notificaciones/no-leidas/count');
    expect(typeof contador.noLeidas).toBe('number');

    // Ocho peticiones con el access token vencido: un único refresh, todas se reintentan.
    cliente.tokens.guardar('token.vencido.invalido');
    const antes = jar.llamadas.filter((l) => l.ruta.endsWith('/auth/refresh')).length;
    const respuestas = await Promise.all(
      Array.from({ length: 8 }, () => cliente.get<Usuario>('/auth/me')),
    );
    expect(respuestas.every((u) => u.id === yo.id)).toBe(true);
    const refreshes = jar.llamadas.filter((l) => l.ruta.endsWith('/auth/refresh')).length - antes;
    expect(refreshes).toBe(1);

    // La sesión sigue válida tras la rotación (no se interpretó como reutilización).
    await expect(cliente.renovar()).resolves.toMatchObject({ usuario: { id: yo.id } });
    await expect(cliente.get<Usuario>('/auth/me')).resolves.toMatchObject({ id: yo.id });

    // Cierre de sesión: revoca el refresh y borra la cookie.
    const cookieAntes = jar.valor('refresh_token')!;
    await cliente.post('/auth/logout', { autenticada: false });
    expect(jar.valor('refresh_token')).toBeUndefined();
    await expect(cliente.renovar()).rejects.toMatchObject({ tipo: 'sesion-vencida' });

    // El refresh anterior, aunque se conserve, ya no sirve.
    jar.restaurar('refresh_token', cookieAntes, '/api/auth');
    await expect(cliente.renovar()).rejects.toMatchObject({ tipo: 'sesion-vencida' });
  }, 150_000);

  it('credenciales incorrectas dan un 401 de tipo http con mensaje en español, sin intentar refresh', async () => {
    const { jar, cliente } = nuevoCliente();
    await expect(
      conLimite(() =>
        cliente.post('/auth/login', {
          autenticada: false,
          cuerpo: { email: EMAIL, contrasena: 'incorrecta-123' },
        }),
      ),
    ).rejects.toMatchObject({ tipo: 'http', estado: 401 });
    expect(jar.llamadas.some((l) => l.ruta.endsWith('/auth/refresh'))).toBe(false);
  }, 150_000);
});
