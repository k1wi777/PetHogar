import type { ClienteHttp } from '@/shared/api/cliente';

/**
 * Para pruebas: sustituye a `@/shared/api/http` y reenvía al cliente que cada prueba monta con su
 * `fetch` simulado (`vi.mock('@/shared/api/http', () => import('../http-prueba').then(...))`).
 */
let actual: ClienteHttp | null = null;

export function fijarClientePrueba(cliente: ClienteHttp): void {
  actual = cliente;
}

export const httpSimulado = new Proxy({} as ClienteHttp, {
  get(_destino, propiedad) {
    if (!actual) throw new Error('Monta la prueba con montar() antes de usar el cliente.');
    const valor = Reflect.get(actual, propiedad, actual) as unknown;
    return typeof valor === 'function' ? valor.bind(actual) : valor;
  },
});
