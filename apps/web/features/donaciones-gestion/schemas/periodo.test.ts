import { describe, expect, it } from 'vitest';
import { MENSAJE_DESDE, MENSAJE_HASTA, MENSAJE_PERIODO_INVERTIDO, esquemaPeriodo } from './periodo';

const mensajes = (e: unknown) => {
  const r = esquemaPeriodo.safeParse(e);
  return r.success ? [] : r.error.issues.map((i) => `${String(i.path[0])}: ${i.message}`);
};

describe('esquema de periodo', () => {
  it('acepta vacío, solo un extremo, mismo día y periodo normal', () => {
    expect(mensajes({ desde: '', hasta: '' })).toEqual([]);
    expect(mensajes({ desde: '2026-10-01', hasta: '' })).toEqual([]);
    expect(mensajes({ desde: '', hasta: '2026-10-31' })).toEqual([]);
    expect(mensajes({ desde: '2026-10-05', hasta: '2026-10-05' })).toEqual([]);
  });
  it('rechaza fechas irreales junto a su campo', () => {
    expect(mensajes({ desde: '2026-02-30', hasta: '' })).toEqual([`desde: ${MENSAJE_DESDE}`]);
    expect(mensajes({ desde: '', hasta: '2026-13-01' })).toEqual([`hasta: ${MENSAJE_HASTA}`]);
  });
  it('rechaza el periodo invertido', () => {
    expect(mensajes({ desde: '2026-10-31', hasta: '2026-10-01' })).toEqual([
      `hasta: ${MENSAJE_PERIODO_INVERTIDO}`,
    ]);
  });
});
