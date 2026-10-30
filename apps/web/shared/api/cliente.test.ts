import { describe, expect, it, vi } from 'vitest';
import { crearClienteHttp } from './cliente';
import { MENSAJES } from './errores';
import { crearAlmacenToken } from './token';
import type { RespuestaSesion } from './tipos';

const BASE = 'http://api.test/api';

function json(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

const usuario = {
  id: 1,
  email: 'a@b.co',
  telefono: '3000000000',
  rol: 'adoptante' as const,
  adoptante: null,
  fundacion: null,
};

function sesion(token: string): RespuestaSesion {
  return { accessToken: token, expiresIn: 900, usuario };
}

describe('ClienteHttp: peticiones y errores', () => {
  it('envía el bearer, JSON y usa la URL base con la consulta', async () => {
    const fetchImpl = vi.fn(async () => json({ ok: true }));
    const tokens = crearAlmacenToken();
    tokens.guardar('tok1');
    const cliente = crearClienteHttp({ baseUrl: BASE, fetchImpl, tokens, cerrojos: null });
    await cliente.post('/cosas', { cuerpo: { a: 1 }, consulta: { page: 2, q: '', x: undefined } });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/cosas?page=2`);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok1');
    expect(init.body).toBe('{"a":1}');
    expect(init.credentials).toBe('same-origin');
  });

  it('no envía bearer si la petición no es autenticada y usa cookies en /auth/*', async () => {
    const fetchImpl = vi.fn(async () => json({}));
    const tokens = crearAlmacenToken();
    tokens.guardar('tok1');
    const cliente = crearClienteHttp({ baseUrl: BASE, fetchImpl, tokens, cerrojos: null });
    await cliente.post('/auth/login', { autenticada: false, cuerpo: {} });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(init.credentials).toBe('include');
  });

  it('devuelve undefined con 204 y deja pasar FormData sin Content-Type', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const cliente = crearClienteHttp({ baseUrl: BASE, fetchImpl, cerrojos: null });
    const datos = new FormData();
    datos.set('a', 'b');
    await expect(cliente.post('/x', { cuerpo: datos })).resolves.toBeUndefined();
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.body).toBe(datos);
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('convierte errores del backend en ErrorApi con mensaje y errores por campo', async () => {
    const fetchImpl = vi.fn(async () =>
      json(
        {
          statusCode: 400,
          message: 'Datos inválidos',
          errores: [{ campo: 'email', mensajes: ['Obligatorio'] }],
        },
        400,
      ),
    );
    const cliente = crearClienteHttp({ baseUrl: BASE, fetchImpl, cerrojos: null });
    await expect(cliente.get('/x')).rejects.toMatchObject({
      tipo: 'http',
      estado: 400,
      mensaje: 'Datos inválidos',
      errores: [{ campo: 'email', mensajes: ['Obligatorio'] }],
    });
  });

  it('usa un mensaje amable ante un 5xx sin cuerpo JSON', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>', { status: 502 }));
    const cliente = crearClienteHttp({ baseUrl: BASE, fetchImpl, cerrojos: null });
    await expect(cliente.get('/x')).rejects.toMatchObject({
      tipo: 'http',
      estado: 502,
      mensaje: MENSAJES.servidor,
    });
  });

  it('una respuesta OK que no es JSON es respuesta-invalida', async () => {
    const fetchImpl = vi.fn(async () => new Response('hola', { status: 200 }));
    const cliente = crearClienteHttp({ baseUrl: BASE, fetchImpl, cerrojos: null });
    await expect(cliente.get('/x')).rejects.toMatchObject({ tipo: 'respuesta-invalida' });
  });

  it('red caída produce un error de tipo red sin tocar el token', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const tokens = crearAlmacenToken();
    tokens.guardar('tok1');
    const cliente = crearClienteHttp({ baseUrl: BASE, fetchImpl, tokens, cerrojos: null });
    await expect(cliente.get('/x')).rejects.toMatchObject({ tipo: 'red', mensaje: MENSAJES.red });
    expect(tokens.obtener()).toBe('tok1');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('el tiempo de espera agotado es un error de red', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_res, rej) => {
          init?.signal?.addEventListener('abort', () =>
            rej(new DOMException('abortado', 'AbortError')),
          );
        }),
    );
    const cliente = crearClienteHttp({
      baseUrl: BASE,
      fetchImpl,
      cerrojos: null,
      tiempoEsperaMs: 20,
    });
    await expect(cliente.get('/x')).rejects.toMatchObject({ tipo: 'red' });
  });
});

describe('ClienteHttp: 401 y renovación', () => {
  /** API simulada: acepta solo el token vigente; cada refresh rota a un token nuevo. */
  function apiSimulada(opciones: { refreshFalla?: 'sin-sesion' | 'red' } = {}) {
    let vigente = 'viejo';
    let refreshes = 0;
    let enRefresh = 0;
    let maximoConcurrente = 0;
    const llamadas: string[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const ruta = url.replace(BASE, '').split('?')[0]!;
      const auth = (init?.headers as Record<string, string>).Authorization;
      llamadas.push(`${ruta} ${auth ?? '-'}`);
      if (ruta === '/auth/refresh') {
        refreshes++;
        enRefresh++;
        maximoConcurrente = Math.max(maximoConcurrente, enRefresh);
        await new Promise((r) => setTimeout(r, 15));
        enRefresh--;
        if (opciones.refreshFalla === 'red') throw new TypeError('Failed to fetch');
        if (opciones.refreshFalla === 'sin-sesion')
          return json({ message: 'Sesión no válida' }, 401);
        vigente = `nuevo${refreshes}`;
        return json(sesion(vigente));
      }
      if (ruta === '/auth/login') return json({ message: 'Correo o contraseña incorrectos' }, 401);
      if (auth === `Bearer ${vigente}`) return json({ ruta });
      return json({ message: 'No autorizado' }, 401);
    });
    return { fetchImpl, estado: () => ({ refreshes, maximoConcurrente, llamadas }) };
  }

  it('ante 401 renueva una vez, reintenta una vez y guarda el token nuevo', async () => {
    const { fetchImpl, estado } = apiSimulada();
    const tokens = crearAlmacenToken();
    tokens.guardar('viejo-vencido');
    const cliente = crearClienteHttp({ baseUrl: BASE, fetchImpl, tokens, cerrojos: null });
    await expect(cliente.get('/datos')).resolves.toEqual({ ruta: '/datos' });
    expect(estado().refreshes).toBe(1);
    expect(tokens.obtener()).toBe('nuevo1');
    expect(estado().llamadas).toEqual([
      '/datos Bearer viejo-vencido',
      '/auth/refresh -',
      '/datos Bearer nuevo1',
    ]);
  });

  it('REGLA CRÍTICA: ocho peticiones con 401 concurrentes producen exactamente un refresh', async () => {
    const { fetchImpl, estado } = apiSimulada();
    const tokens = crearAlmacenToken();
    tokens.guardar('caducado');
    const cliente = crearClienteHttp({ baseUrl: BASE, fetchImpl, tokens, cerrojos: null });
    const resultados = await Promise.all(
      Array.from({ length: 8 }, (_, i) => cliente.get(`/datos/${i}`)),
    );
    expect(resultados).toEqual(Array.from({ length: 8 }, (_, i) => ({ ruta: `/datos/${i}` })));
    expect(estado().refreshes).toBe(1);
    expect(estado().maximoConcurrente).toBe(1);
    expect(tokens.obtener()).toBe('nuevo1');
  });

  it('llamadas directas a renovar() simultáneas comparten una sola petición', async () => {
    const { fetchImpl, estado } = apiSimulada();
    const cliente = crearClienteHttp({ baseUrl: BASE, fetchImpl, cerrojos: null });
    const [a, b, c] = await Promise.all([cliente.renovar(), cliente.renovar(), cliente.renovar()]);
    expect(estado().refreshes).toBe(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
    // Pasada la renovación, una nueva sí puede iniciar otra.
    await cliente.renovar();
    expect(estado().refreshes).toBe(2);
  });

  it('una petición tardía con token ya reemplazado reintenta sin renovar de nuevo', async () => {
    const { fetchImpl, estado } = apiSimulada();
    const tokens = crearAlmacenToken();
    tokens.guardar('caducado');
    const cliente = crearClienteHttp({ baseUrl: BASE, fetchImpl, tokens, cerrojos: null });
    await cliente.get('/a');
    tokens.guardar('nuevo1'); // ya vigente; otra petición con token viejo no debe volver a rotar
    await expect(cliente.get('/b')).resolves.toEqual({ ruta: '/b' });
    expect(estado().refreshes).toBe(1);
  });

  it('si el refresh es rechazado todas fallan con sesion-vencida, sin segundo refresh y avisando una vez', async () => {
    const { fetchImpl, estado } = apiSimulada({ refreshFalla: 'sin-sesion' });
    const tokens = crearAlmacenToken();
    tokens.guardar('caducado');
    const cliente = crearClienteHttp({ baseUrl: BASE, fetchImpl, tokens, cerrojos: null });
    const oyente = vi.fn();
    cliente.alVencerSesion(oyente);
    const resultados = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) => cliente.get(`/d/${i}`)),
    );
    for (const r of resultados) {
      expect(r).toMatchObject({ status: 'rejected', reason: { tipo: 'sesion-vencida' } });
    }
    expect(estado().refreshes).toBe(1);
    expect(oyente).toHaveBeenCalledTimes(1);
    expect(tokens.obtener()).toBeNull();
  });

  it('si el refresh falla por red, no cierra la sesión: conserva el token y propaga error de red', async () => {
    const { fetchImpl } = apiSimulada({ refreshFalla: 'red' });
    const tokens = crearAlmacenToken();
    tokens.guardar('caducado');
    const cliente = crearClienteHttp({ baseUrl: BASE, fetchImpl, tokens, cerrojos: null });
    const oyente = vi.fn();
    cliente.alVencerSesion(oyente);
    await expect(cliente.get('/d')).rejects.toMatchObject({ tipo: 'red' });
    expect(tokens.obtener()).toBe('caducado');
    expect(oyente).not.toHaveBeenCalled();
  });

  it('el 401 de /auth/login (credenciales) no dispara refresh', async () => {
    const { fetchImpl, estado } = apiSimulada();
    const cliente = crearClienteHttp({ baseUrl: BASE, fetchImpl, cerrojos: null });
    await expect(cliente.post('/auth/login', { cuerpo: {} })).rejects.toMatchObject({
      tipo: 'http',
      estado: 401,
      mensaje: 'Correo o contraseña incorrectos',
    });
    expect(estado().refreshes).toBe(0);
  });

  it('si tras renovar sigue dando 401, lanza sesion-vencida y no reintenta más', async () => {
    let refreshes = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/refresh')) {
        refreshes++;
        return json(sesion('otro'));
      }
      return json({ message: 'No autorizado' }, 401);
    });
    const cliente = crearClienteHttp({ baseUrl: BASE, fetchImpl, cerrojos: null });
    await expect(cliente.get('/d')).rejects.toMatchObject({ tipo: 'sesion-vencida' });
    expect(refreshes).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('usa el cerrojo entre pestañas alrededor del refresh', async () => {
    const { fetchImpl } = apiSimulada();
    const nombres: string[] = [];
    const cerrojos = {
      request: async <T>(nombre: string, cb: () => Promise<T>) => {
        nombres.push(nombre);
        return cb();
      },
    };
    const cliente = crearClienteHttp({ baseUrl: BASE, fetchImpl, cerrojos });
    await Promise.all([cliente.renovar(), cliente.renovar()]);
    expect(nombres).toEqual(['pethogar-refresh']);
  });
});

describe('ClienteHttp: descargar', () => {
  const pdf = () =>
    new Response(new Uint8Array([37, 80, 68, 70]), {
      status: 200,
      headers: { 'Content-Type': 'application/pdf; charset=binary' },
    });

  it('entrega el blob con el tipo real, con bearer y Accept */*', async () => {
    const fetchImpl = vi.fn(async () => pdf());
    const tokens = crearAlmacenToken();
    tokens.guardar('tok1');
    const cliente = crearClienteHttp({ baseUrl: BASE, fetchImpl, tokens, cerrojos: null });
    const archivo = await cliente.descargar('/fundacion/solicitudes/3/formulario');
    expect(archivo.tipo).toBe('application/pdf');
    expect(archivo.blob.size).toBe(4);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/fundacion/solicitudes/3/formulario`);
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok1');
    expect(headers.Accept).toBe('*/*');
  });

  it('un error de descarga conserva el mensaje JSON del backend', async () => {
    const fetchImpl = vi.fn(async () => json({ message: 'No encontramos el archivo' }, 404));
    const cliente = crearClienteHttp({ baseUrl: BASE, fetchImpl, cerrojos: null });
    await expect(cliente.descargar('/x')).rejects.toMatchObject({
      estado: 404,
      mensaje: 'No encontramos el archivo',
    });
  });

  it('REGLA CRÍTICA: descargas concurrentes con 401 producen una sola renovación', async () => {
    let vigente = 'viejo';
    let refreshes = 0;
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const ruta = url.replace(BASE, '');
      if (ruta === '/auth/refresh') {
        refreshes++;
        await new Promise((r) => setTimeout(r, 10));
        vigente = `nuevo${refreshes}`;
        return json(sesion(vigente));
      }
      const auth = (init?.headers as Record<string, string>).Authorization;
      return auth === `Bearer ${vigente}` ? pdf() : json({ message: 'No autorizado' }, 401);
    });
    const tokens = crearAlmacenToken();
    tokens.guardar('caducado');
    const cliente = crearClienteHttp({ baseUrl: BASE, fetchImpl, tokens, cerrojos: null });
    const todas = await Promise.all([
      cliente.descargar('/a'),
      cliente.descargar('/b'),
      cliente.descargar('/c'),
    ]);
    expect(todas.every((a) => a.tipo === 'application/pdf')).toBe(true);
    expect(refreshes).toBe(1);
  });
});
