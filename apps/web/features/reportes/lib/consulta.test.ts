import { describe, expect, it } from 'vitest';
import {
  PERIODO_TODO,
  aConsultaEstadisticas,
  consultaAUrl,
  leerConsulta,
  periodoEsteMes,
  periodoMesAnterior,
} from './consulta';

const p = (q: string) => leerConsulta(new URLSearchParams(q));

describe('consulta de reportes', () => {
  it('por defecto: adopciones sin rango ni fundación', () => {
    expect(p('')).toEqual({
      reporte: 'adopciones',
      desde: undefined,
      hasta: undefined,
      fundacion: undefined,
    });
  });
  it('lee reporte, rango y fundación', () => {
    expect(p('reporte=donaciones&desde=2026-10-01&hasta=2026-10-31&fundacion=7')).toEqual({
      reporte: 'donaciones',
      desde: '2026-10-01',
      hasta: '2026-10-31',
      fundacion: 7,
    });
  });
  it('ignora reportes desconocidos, fechas irreales, fundaciones inválidas y rangos invertidos', () => {
    const r = p('reporte=otro&desde=2026-02-30&fundacion=-3');
    expect(r.reporte).toBe('adopciones');
    expect(r.desde).toBeUndefined();
    expect(r.fundacion).toBeUndefined();
    expect(p('fundacion=0').fundacion).toBeUndefined();
    const inv = p('desde=2026-10-31&hasta=2026-10-01');
    expect(inv.desde).toBeUndefined();
    expect(inv.hasta).toBeUndefined();
  });
  it('serializa solo lo que se aparta del valor por defecto', () => {
    expect(consultaAUrl({ reporte: 'adopciones' })).toBe('');
    expect(
      consultaAUrl({
        reporte: 'seguimientos',
        desde: '2026-10-01',
        hasta: '2026-10-31',
        fundacion: 3,
      }),
    ).toBe('?reporte=seguimientos&desde=2026-10-01&hasta=2026-10-31&fundacion=3');
  });
  it('al servidor solo viaja el rango, y la fundación únicamente en el ámbito administrador', () => {
    const c = { reporte: 'donaciones' as const, desde: '2026-10-01', fundacion: 4 };
    expect(aConsultaEstadisticas(c, 'fundacion')).toEqual({
      desde: '2026-10-01',
      hasta: undefined,
      fundacionId: undefined,
    });
    expect(aConsultaEstadisticas(c, 'administrador').fundacionId).toBe(4);
  });
  it('los atajos usan el calendario de Bogotá, incluso el cambio de año', () => {
    expect(periodoEsteMes('2026-10-15')).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' });
    expect(periodoMesAnterior('2026-10-15')).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' });
    expect(periodoMesAnterior('2027-01-03')).toEqual({ desde: '2026-12-01', hasta: '2026-12-31' });
    expect(periodoEsteMes('2028-02-10').hasta).toBe('2028-02-29');
    expect(PERIODO_TODO).toEqual({});
  });
});
