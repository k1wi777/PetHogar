import { describe, expect, it } from 'vitest';
import {
  PERIODO_TODO,
  consultaAUrl,
  leerConsulta,
  periodoEsteMes,
  periodoMesAnterior,
} from './consulta';

const p = (q: string) => leerConsulta(new URLSearchParams(q));

describe('consulta de donaciones', () => {
  it('lee periodo, tipo y página', () => {
    expect(p('')).toEqual({ pagina: 1, desde: undefined, hasta: undefined, tipo: undefined });
    expect(p('desde=2026-10-01&hasta=2026-10-31&tipo=especie&pagina=2')).toEqual({
      pagina: 2,
      desde: '2026-10-01',
      hasta: '2026-10-31',
      tipo: 'especie',
    });
  });
  it('ignora fechas irreales, tipos desconocidos y periodos invertidos', () => {
    expect(p('desde=2026-02-30&tipo=otro&pagina=0')).toEqual({
      pagina: 1,
      desde: undefined,
      hasta: undefined,
      tipo: undefined,
    });
    const invertido = p('desde=2026-10-31&hasta=2026-10-01');
    expect(invertido.desde).toBeUndefined();
    expect(invertido.hasta).toBeUndefined();
  });
  it('construye la URL con los filtros y la página', () => {
    expect(consultaAUrl({ pagina: 1 })).toBe('');
    expect(
      consultaAUrl({ pagina: 3, desde: '2026-10-01', hasta: '2026-10-31', tipo: 'economica' }),
    ).toBe('?desde=2026-10-01&hasta=2026-10-31&tipo=economica&pagina=3');
  });
  it('los atajos usan el calendario sobre cadenas', () => {
    expect(periodoEsteMes('2026-03-17')).toEqual({ desde: '2026-03-01', hasta: '2026-03-31' });
    expect(periodoMesAnterior('2026-03-17')).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' });
    expect(periodoMesAnterior('2026-01-05')).toEqual({ desde: '2025-12-01', hasta: '2025-12-31' });
    expect(periodoMesAnterior('2028-03-01')).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' });
    expect(PERIODO_TODO).toEqual({});
  });
});
