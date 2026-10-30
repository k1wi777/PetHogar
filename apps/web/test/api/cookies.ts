import type { FetchImpl } from '@/shared/api/cliente';

interface Galleta {
  nombre: string;
  valor: string;
  ruta: string;
  atributos: string;
}

/**
 * Cookie jar mínimo (el `fetch` de Node no guarda cookies): reproduce lo esencial del navegador,
 * es decir, guarda `Set-Cookie`, respeta `Path` y borra con `Max-Age=0`.
 */
export function crearFetchConCookies(origen: string) {
  const galletas = new Map<string, Galleta>();
  const setCookiesCrudos: string[] = [];
  const llamadas: Array<{ metodo: string; ruta: string }> = [];

  const fetchImpl: FetchImpl = async (url, init) => {
    const { pathname } = new URL(url);
    const enviables = [...galletas.values()].filter((g) => pathname.startsWith(g.ruta));
    const headers = new Headers(init?.headers);
    headers.set('Origin', origen);
    if (init?.credentials === 'include' && enviables.length > 0) {
      headers.set('Cookie', enviables.map((g) => `${g.nombre}=${g.valor}`).join('; '));
    }
    llamadas.push({ metodo: init?.method ?? 'GET', ruta: pathname });
    const respuesta = await fetch(url, { ...init, headers });
    for (const crudo of respuesta.headers.getSetCookie()) {
      setCookiesCrudos.push(crudo);
      const [par, ...atributos] = crudo.split(';').map((p) => p.trim());
      const [nombre, ...resto] = par!.split('=');
      const valor = resto.join('=');
      const ruta = atributos.find((a) => /^path=/i.test(a))?.slice(5) ?? '/';
      const vencida = atributos.some((a) => /^max-age=0$/i.test(a)) || valor === '';
      if (vencida) galletas.delete(nombre!);
      else galletas.set(nombre!, { nombre: nombre!, valor, ruta, atributos: atributos.join('; ') });
    }
    return respuesta;
  };

  return {
    fetchImpl,
    llamadas,
    setCookiesCrudos,
    valor: (nombre: string) => galletas.get(nombre)?.valor,
    restaurar: (nombre: string, valor: string, ruta: string) =>
      galletas.set(nombre, { nombre, valor, ruta, atributos: '' }),
  };
}
