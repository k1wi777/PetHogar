import { describe, expect, it } from 'vitest';
import { consultaAUrl, leerConsulta, leerId, rutaDetalle, rutaLista } from './consulta';

const p = (q: string) => leerConsulta(new URLSearchParams(q));

describe('consulta de «Mis solicitudes»', () => {
  it('lee página y estado y descarta lo inválido', () => {
    expect(p('')).toEqual({ pagina: 1, estado: undefined });
    expect(p('pagina=3&estado=pendiente')).toEqual({ pagina: 3, estado: 'pendiente' });
    expect(p('pagina=0&estado=raro')).toEqual({ pagina: 1, estado: undefined });
    expect(p('pagina=-2')).toEqual({ pagina: 1, estado: undefined });
    expect(p('pagina=1e3')).toEqual({ pagina: 1, estado: undefined });
  });
  it('construye URLs que conservan filtro y página', () => {
    expect(consultaAUrl({ pagina: 1 })).toBe('');
    expect(rutaLista({ pagina: 2, estado: 'cancelada' })).toBe(
      '/adoptante/solicitudes?pagina=2&estado=cancelada',
    );
    expect(rutaDetalle(9, { pagina: 2, estado: 'pendiente' })).toBe(
      '/adoptante/solicitudes/9?pagina=2&estado=pendiente',
    );
  });
  it('leerId solo acepta enteros positivos', () => {
    expect(leerId('12')).toBe(12);
    for (const malo of ['0', '-1', 'a', '1.5', '', null, undefined])
      expect(leerId(malo)).toBeNull();
  });
});
