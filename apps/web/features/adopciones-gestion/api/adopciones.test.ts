import { describe, expect, it, vi } from 'vitest';
import { crearClienteHttp } from '@/shared/api/cliente';
import {
  listarAdopciones,
  obtenerSeguimiento,
  programarSeguimiento,
  registrarResultado,
} from './adopciones';

const BASE = 'http://api.test/api';
const json = (c: unknown) =>
  new Response(JSON.stringify(c), { status: 200, headers: { 'Content-Type': 'application/json' } });
function cliente() {
  const fetchImpl = vi.fn(async () => json({}));
  return { fetchImpl, http: crearClienteHttp({ baseUrl: BASE, fetchImpl, cerrojos: null }) };
}
const llamada = (f: ReturnType<typeof cliente>['fetchImpl']) =>
  f.mock.calls[0] as unknown as [string, RequestInit];
const foto = (n: string) => new File([new Uint8Array(4)], n, { type: 'image/png' });

describe('api de adopciones de la fundación', () => {
  it('lista con estado y página', async () => {
    const a = cliente();
    await listarAdopciones({ pagina: 2, estado: 'activa' }, a.http);
    expect(llamada(a.fetchImpl)[0]).toBe(
      `${BASE}/fundacion/adopciones?page=2&limit=10&estado=activa`,
    );
  });
  it('programa con tipo y fecha por POST', async () => {
    const a = cliente();
    await programarSeguimiento(4, { tipo: 'visita', fechaProgramada: '2026-12-15' }, a.http);
    const [url, init] = llamada(a.fetchImpl);
    expect(url).toBe(`${BASE}/adopciones/4/seguimientos`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      tipo: 'visita',
      fechaProgramada: '2026-12-15',
    });
  });
  it('lee el detalle del seguimiento', async () => {
    const a = cliente();
    await obtenerSeguimiento(9, a.http);
    expect(llamada(a.fetchImpl)[0]).toBe(`${BASE}/fundacion/seguimientos/9`);
  });
  it.each([0, 1, 5])('el resultado viaja como multipart con %i evidencias repetidas', async (n) => {
    const a = cliente();
    await registrarResultado(
      9,
      {
        fechaRealizada: '2026-12-05',
        estadoBienestar: 'malo',
        observaciones: 'Flaco',
        evidencias: Array.from({ length: n }, (_, i) => foto(`e${i}.png`)),
      },
      a.http,
    );
    const [url, init] = llamada(a.fetchImpl);
    expect(url).toBe(`${BASE}/seguimientos/9/resultado`);
    expect(init.method).toBe('PATCH');
    const cuerpo = init.body as FormData;
    expect(cuerpo.get('fechaRealizada')).toBe('2026-12-05');
    expect(cuerpo.get('estadoBienestar')).toBe('malo');
    expect(cuerpo.get('observaciones')).toBe('Flaco');
    expect(cuerpo.getAll('evidencias')).toHaveLength(n);
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });
});
