import { describe, expect, it, vi } from 'vitest';
import { crearClienteHttp } from '@/shared/api/cliente';
import { leerTodas, listarNotificaciones, marcarLeida } from './notificaciones';

const BASE = 'http://api.test/api';
const json = (c: unknown) =>
  new Response(JSON.stringify(c), { status: 200, headers: { 'Content-Type': 'application/json' } });
function cliente() {
  const fetchImpl = vi.fn(async () => json({}));
  return { fetchImpl, http: crearClienteHttp({ baseUrl: BASE, fetchImpl, cerrojos: null }) };
}
const llamada = (f: ReturnType<typeof cliente>['fetchImpl']) =>
  f.mock.calls[0] as unknown as [string, RequestInit];

describe('api de notificaciones', () => {
  it('lista todas sin enviar el filtro leida', async () => {
    const a = cliente();
    await listarNotificaciones({ pagina: 2, filtro: 'todas' }, 10, a.http);
    expect(llamada(a.fetchImpl)[0]).toBe(`${BASE}/notificaciones?page=2&limit=10`);
  });
  it('filtra por no leídas y leídas', async () => {
    const a = cliente();
    await listarNotificaciones({ pagina: 1, filtro: 'no-leidas' }, 10, a.http);
    expect(llamada(a.fetchImpl)[0]).toBe(`${BASE}/notificaciones?page=1&limit=10&leida=false`);
    const b = cliente();
    await listarNotificaciones({ pagina: 1, filtro: 'leidas' }, 5, b.http);
    expect(llamada(b.fetchImpl)[0]).toBe(`${BASE}/notificaciones?page=1&limit=5&leida=true`);
  });
  it('marca una como leída por PATCH', async () => {
    const a = cliente();
    await marcarLeida(7, a.http);
    const [url, init] = llamada(a.fetchImpl);
    expect(url).toBe(`${BASE}/notificaciones/7/leida`);
    expect(init.method).toBe('PATCH');
  });
  it('marca todas por PATCH', async () => {
    const a = cliente();
    await leerTodas(a.http);
    const [url, init] = llamada(a.fetchImpl);
    expect(url).toBe(`${BASE}/notificaciones/leer-todas`);
    expect(init.method).toBe('PATCH');
  });
});
