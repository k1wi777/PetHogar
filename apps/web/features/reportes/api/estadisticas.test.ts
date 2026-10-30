import { describe, expect, it, vi } from 'vitest';
import { crearClienteHttp } from '@/shared/api/cliente';
import { listarFundacionesAprobadas } from './fundaciones';
import { obtenerEstadisticas } from './estadisticas';

const BASE = 'http://api.test/api';
const json = (c: unknown) =>
  new Response(JSON.stringify(c), { status: 200, headers: { 'Content-Type': 'application/json' } });

function cliente(respuesta: () => Response) {
  const fetchImpl = vi.fn(async () => respuesta());
  return { fetchImpl, http: crearClienteHttp({ baseUrl: BASE, fetchImpl, cerrojos: null }) };
}
const url = (f: ReturnType<typeof cliente>['fetchImpl']) =>
  (f.mock.calls[0] as unknown as [string])[0];

describe('api de estadísticas', () => {
  it('la fundación consulta la propia y nunca envía fundacionId', async () => {
    const { fetchImpl, http } = cliente(() => json({}));
    await obtenerEstadisticas(
      'fundacion',
      { desde: '2026-10-01', hasta: '2026-10-31', fundacionId: 9 },
      http,
    );
    expect(url(fetchImpl)).toBe(`${BASE}/fundacion/estadisticas?desde=2026-10-01&hasta=2026-10-31`);
  });
  it('el administrador consulta la plataforma, con o sin fundación', async () => {
    const a = cliente(() => json({}));
    await obtenerEstadisticas('administrador', {}, a.http);
    expect(url(a.fetchImpl)).toBe(`${BASE}/admin/estadisticas`);
    const b = cliente(() => json({}));
    await obtenerEstadisticas('administrador', { fundacionId: 4, desde: '2026-10-01' }, b.http);
    expect(url(b.fetchImpl)).toBe(`${BASE}/admin/estadisticas?fundacionId=4&desde=2026-10-01`);
  });
  it('el selector pide las aprobadas con el tope de 100 y avisa si hay más', async () => {
    const { fetchImpl, http } = cliente(() =>
      json({ total: 130, page: 1, limit: 100, data: [{ id: 1, nombre: 'A', nit: 'x' }] }),
    );
    const r = await listarFundacionesAprobadas(http);
    expect(url(fetchImpl)).toBe(`${BASE}/admin/fundaciones?estado=aprobada&limit=100&page=1`);
    expect(r).toEqual({ fundaciones: [{ id: 1, nombre: 'A' }], hayMas: true });
  });
});
