import { describe, expect, it } from 'vitest';
import { consultaAUrl, leerConsulta, leerId, rutaLista, rutaRevision } from './consulta';

const p = (q: string) => leerConsulta(new URLSearchParams(q));

describe('consulta de solicitudes recibidas', () => {
  it('lee estado, mascota y página y descarta lo inválido', () => {
    expect(p('')).toEqual({ pagina: 1, estado: undefined, mascotaId: undefined });
    expect(p('estado=pendiente&mascota=7&pagina=3')).toEqual({
      pagina: 3,
      estado: 'pendiente',
      mascotaId: 7,
    });
    expect(p('estado=raro&mascota=abc&pagina=0')).toEqual({
      pagina: 1,
      estado: undefined,
      mascotaId: undefined,
    });
    expect(p('mascota=0').mascotaId).toBeUndefined();
    expect(p('mascota=-3').mascotaId).toBeUndefined();
    expect(p('pagina=1e3').pagina).toBe(1);
  });
  it('construye URLs que conservan filtros y página', () => {
    expect(consultaAUrl({ pagina: 1 })).toBe('');
    expect(rutaLista({ pagina: 2, estado: 'aprobada', mascotaId: 5 })).toBe(
      '/fundacion/solicitudes?estado=aprobada&mascota=5&pagina=2',
    );
    expect(rutaRevision(9, { pagina: 1, mascotaId: 5 })).toBe('/fundacion/solicitudes/9?mascota=5');
  });
  it('leerId solo acepta enteros positivos', () => {
    expect(leerId('12')).toBe(12);
    for (const malo of ['0', '-1', 'a', '1.5', '', null, undefined, '12345678901'])
      expect(leerId(malo)).toBeNull();
  });
});
