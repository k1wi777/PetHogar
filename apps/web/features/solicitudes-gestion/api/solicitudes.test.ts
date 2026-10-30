import { describe, expect, it, vi } from 'vitest';
import { crearClienteHttp } from '@/shared/api/cliente';
import {
  decidirSolicitud,
  descargarFormulario,
  listarMascotasParaFiltro,
  listarSolicitudesRecibidas,
} from './solicitudes';

const BASE = 'http://api.test/api';
const json = (c: unknown) =>
  new Response(JSON.stringify(c), { status: 200, headers: { 'Content-Type': 'application/json' } });

function cliente(respuesta: () => Response) {
  const fetchImpl = vi.fn(async () => respuesta());
  return { fetchImpl, http: crearClienteHttp({ baseUrl: BASE, fetchImpl, cerrojos: null }) };
}
const llamada = (f: ReturnType<typeof cliente>['fetchImpl']) =>
  f.mock.calls[0] as unknown as [string, RequestInit];

describe('api de solicitudes recibidas', () => {
  it('lista con estado, mascota y página', async () => {
    const { fetchImpl, http } = cliente(() => json({ total: 0, page: 2, limit: 10, data: [] }));
    await listarSolicitudesRecibidas({ pagina: 2, estado: 'pendiente', mascotaId: 7 }, 10, http);
    expect(llamada(fetchImpl)[0]).toBe(
      `${BASE}/fundacion/solicitudes?page=2&limit=10&estado=pendiente&mascotaId=7`,
    );
  });
  it('aprobar envía fecha y solo envía observación si existe', async () => {
    const a = cliente(() => json({}));
    await decidirSolicitud(3, { decision: 'aprobar', fechaEntrega: '2026-11-20' }, a.http);
    expect(llamada(a.fetchImpl)[0]).toBe(`${BASE}/solicitudes/3/decision`);
    expect(llamada(a.fetchImpl)[1].method).toBe('PATCH');
    expect(JSON.parse(llamada(a.fetchImpl)[1].body as string)).toEqual({
      decision: 'aprobar',
      fechaEntrega: '2026-11-20',
    });
  });
  it('rechazar no envía fecha de entrega', async () => {
    const a = cliente(() => json({}));
    await decidirSolicitud(
      3,
      { decision: 'rechazar', observacion: 'No cumple', fechaEntrega: '2026-11-20' } as never,
      a.http,
    );
    expect(JSON.parse(llamada(a.fetchImpl)[1].body as string)).toEqual({
      decision: 'rechazar',
      observacion: 'No cumple',
    });
  });
  it('el selector de mascotas pide 100 y deja solo id y nombre', async () => {
    const a = cliente(() =>
      json({ total: 1, page: 1, limit: 100, data: [{ id: 4, nombre: 'Luna', razaId: 2 }] }),
    );
    await expect(listarMascotasParaFiltro(a.http)).resolves.toEqual({
      mascotas: [{ id: 4, nombre: 'Luna' }],
      hayMas: false,
    });
    expect(llamada(a.fetchImpl)[0]).toBe(`${BASE}/fundacion/mascotas?page=1&limit=100`);
  });
  it('el formulario se descarga por la ruta sin /api y rechaza enlaces ajenos', async () => {
    const a = cliente(
      () => new Response('x', { status: 200, headers: { 'Content-Type': 'application/pdf' } }),
    );
    await descargarFormulario('/api/fundacion/solicitudes/3/formulario', a.http);
    expect(llamada(a.fetchImpl)[0]).toBe(`${BASE}/fundacion/solicitudes/3/formulario`);
    expect(() => descargarFormulario('https://evil.test/x', a.http)).toThrow();
  });
});
