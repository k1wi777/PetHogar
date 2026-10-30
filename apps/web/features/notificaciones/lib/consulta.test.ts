import { describe, expect, it } from 'vitest';
import { consultaAUrl, leerConsulta } from './consulta';

const p = (t: string) => new URLSearchParams(t);

describe('consulta de notificaciones ↔ URL', () => {
  it('sin parámetros: todas, página 1', () => {
    expect(leerConsulta(p(''))).toEqual({ pagina: 1, filtro: 'todas' });
  });
  it('lee filtro y página', () => {
    expect(leerConsulta(p('leida=false&pagina=3'))).toEqual({ pagina: 3, filtro: 'no-leidas' });
    expect(leerConsulta(p('leida=true'))).toEqual({ pagina: 1, filtro: 'leidas' });
  });
  it.each(['leida=si', 'leida=constructor', 'pagina=0', 'pagina=-2', 'pagina=abc', 'pagina=1e3'])(
    'normaliza el parámetro inválido %s a la vista por defecto',
    (t) => {
      expect(leerConsulta(p(t))).toEqual({ pagina: 1, filtro: 'todas' });
    },
  );
  it('escribe solo lo que difiere del valor por defecto', () => {
    expect(consultaAUrl({ pagina: 1, filtro: 'todas' })).toBe('');
    expect(consultaAUrl({ pagina: 2, filtro: 'no-leidas' })).toBe('?leida=false&pagina=2');
    expect(consultaAUrl({ pagina: 1, filtro: 'leidas' })).toBe('?leida=true');
  });
});
