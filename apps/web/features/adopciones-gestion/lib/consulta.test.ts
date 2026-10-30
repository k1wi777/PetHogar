import { describe, expect, it } from 'vitest';
import { consultaAUrl, leerConsulta, leerId, rutaLista, rutaSeguimiento } from './consulta';

const p = (q: string) => leerConsulta(new URLSearchParams(q));

describe('consulta de adopciones', () => {
  it('lee estado y página y descarta lo inválido', () => {
    expect(p('')).toEqual({ pagina: 1, estado: undefined });
    expect(p('estado=activa&pagina=2')).toEqual({ pagina: 2, estado: 'activa' });
    expect(p('estado=raro&pagina=-1')).toEqual({ pagina: 1, estado: undefined });
  });
  it('construye URLs y rutas', () => {
    expect(consultaAUrl({ pagina: 1 })).toBe('');
    expect(rutaLista({ pagina: 3, estado: 'revocada' })).toBe(
      '/fundacion/adopciones?estado=revocada&pagina=3',
    );
    expect(rutaSeguimiento(8)).toBe('/fundacion/adopciones/seguimientos/8');
  });
  it('leerId solo acepta enteros positivos', () => {
    expect(leerId('5')).toBe(5);
    for (const malo of ['0', '-1', 'x', '', null, undefined]) expect(leerId(malo)).toBeNull();
  });
});
