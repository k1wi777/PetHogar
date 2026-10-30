import { describe, expect, it } from 'vitest';
import { estadisticas, estadisticasVacias } from '../prueba-datos';
import {
  mesCorto,
  mesEnTexto,
  porcentajes,
  serieAdopcionesPorEspecie,
  serieAdopcionesPorMes,
  serieBienestar,
  serieDonacionesPorMes,
  serieDonacionesPorTipo,
  serieSeguimientos,
  serieSolicitudes,
  seriesDe,
} from './series';

describe('porcentajes', () => {
  it('suman siempre 100 (mayor resto) en casos que el redondeo simple rompería', () => {
    for (const v of [
      [1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1],
      [3, 3, 3, 1],
      [2, 0, 0, 1],
      [5],
      [1, 2],
      [33, 33, 34],
      [1, 1, 1, 197],
    ]) {
      expect(
        porcentajes(v).reduce((a, b) => a + b, 0),
        JSON.stringify(v),
      ).toBe(100);
    }
    expect(porcentajes([1, 1, 1])).toEqual([34, 33, 33]);
    expect(porcentajes([5])).toEqual([100]);
  });
  it('[1,1,1,197] suma 100 con el mayor resto (un Math.round daría 102)', () => {
    const p = porcentajes([1, 1, 1, 197]);
    expect(p.reduce((a, b) => a + b, 0)).toBe(100);
    expect(p).toEqual([1, 1, 0, 98]);
  });
  it('con todo en cero devuelve ceros (la serie no se dibuja)', () => {
    expect(porcentajes([0, 0, 0])).toEqual([0, 0, 0]);
  });
  it('una categoría en cero se queda en 0 %', () => {
    expect(porcentajes([2, 0, 1])).toEqual([67, 0, 33]);
  });
});

describe('meses en texto (sin Date)', () => {
  it('convierte AAAA-MM', () => {
    expect(mesEnTexto('2026-10')).toBe('octubre de 2026');
    expect(mesEnTexto('2027-01')).toBe('enero de 2027');
    expect(mesCorto('2026-12')).toBe('dic 2026');
    expect(mesEnTexto('raro')).toBe('raro');
  });
});

describe('series: datos del servidor → filas (única fuente de gráfica y tabla)', () => {
  const d = estadisticas();

  it('adopciones por mes: ordenadas cronológicamente, meses en texto, total = suma', () => {
    const s = serieAdopcionesPorMes(d);
    expect(s.filas.map((f) => f.celdas)).toEqual([
      ['septiembre de 2026', '2'],
      ['octubre de 2026', '3'],
    ]);
    expect(s.total).toBe(5);
    expect(s.tipo).toBe('columnas');
    expect(s.descripcion).toContain('octubre de 2026 con 3');
  });

  it('adopciones por especie: más adopciones primero y barras horizontales', () => {
    const s = serieAdopcionesPorEspecie(d);
    expect(s.filas.map((f) => f.celdas)).toEqual([
      ['Perro', '3'],
      ['Gato', '2'],
    ]);
    expect(s.tipo).toBe('barras');
  });

  it('solicitudes: orden fijo del dominio (incluidas las de 0), dona y porcentajes que suman 100', () => {
    const s = serieSolicitudes(d);
    expect(s.filas.map((f) => f.etiqueta)).toEqual([
      'Pendiente',
      'Aprobada',
      'Rechazada',
      'Cancelada',
    ]);
    expect(s.filas.map((f) => f.valor)).toEqual([3, 2, 1, 1]);
    expect(s.filas.reduce((a, f) => a + (f.porcentaje ?? 0), 0)).toBe(100);
    expect(s.total).toBe(d.solicitudes.total);
    expect(s.tipo).toBe('dona');
    expect(s.descripcion).toContain('7 solicitudes en total');
    expect(s.filas[0]!.celdas).toEqual(['Pendiente', '3', '43 %']);
  });

  it('seguimientos y bienestar: dona; el total de bienestar es el de los valorados', () => {
    const e = serieSeguimientos(d);
    expect(e.filas.map((f) => f.etiqueta)).toEqual([
      'Programado',
      'Realizado',
      'Vencido',
      'Cancelado',
    ]);
    expect(e.total).toBe(d.seguimientos.total);
    const b = serieBienestar(d);
    expect(b.filas.map((f) => f.etiqueta)).toEqual(['Bueno', 'Regular', 'Malo']);
    expect(b.total).toBe(3);
    expect(b.tipo).toBe('dona');
    expect(b.filas.reduce((a, f) => a + (f.porcentaje ?? 0), 0)).toBe(100);
  });

  it('donaciones por mes: los montos salen de la cadena del servidor (sin perder precisión)', () => {
    const s = serieDonacionesPorMes(d);
    expect(s.filas[0]!.celdas).toEqual(['septiembre de 2026', '1', '$ 9.007.199.254.740.993,10']);
    expect(s.filas[1]!.celdas).toEqual(['octubre de 2026', '3', '$ 150.000,50']);
    expect(s.filas[1]!.valorTexto).toBe('$ 150.000,50');
    expect(s.total).toBe(4);
  });

  it('donaciones por tipo: dona por cantidad con el monto económico solo en la tabla', () => {
    const s = serieDonacionesPorTipo(d);
    expect(s.columnas).toEqual(['Tipo', 'Cantidad', 'Porcentaje', 'Monto']);
    expect(s.filas.map((f) => f.celdas)).toEqual([
      ['Económica', '3', '75 %', '$ 9.007.199.254.741.093,60'],
      ['En especie', '1', '25 %', '—'],
    ]);
    expect(s.tipo).toBe('dona');
  });

  it('cada fila tiene tantas celdas como columnas', () => {
    for (const r of ['adopciones', 'solicitudes', 'seguimientos', 'donaciones'] as const) {
      for (const s of seriesDe(r, d)) {
        for (const f of s.filas) expect(f.celdas, s.id).toHaveLength(s.columnas.length);
      }
    }
  });

  it('seriesDe devuelve las series de cada tipo, en orden', () => {
    expect(seriesDe('adopciones', d).map((s) => s.id)).toEqual([
      'adopciones-por-mes',
      'adopciones-por-especie',
    ]);
    expect(seriesDe('solicitudes', d).map((s) => s.id)).toEqual(['solicitudes-por-estado']);
    expect(seriesDe('seguimientos', d).map((s) => s.id)).toEqual([
      'seguimientos-por-estado',
      'seguimientos-por-bienestar',
    ]);
    expect(seriesDe('donaciones', d).map((s) => s.id)).toEqual([
      'donaciones-por-mes',
      'donaciones-por-tipo',
    ]);
  });

  it('sin datos: total 0 y nada que graficar', () => {
    const v = estadisticasVacias();
    for (const r of ['adopciones', 'solicitudes', 'seguimientos', 'donaciones'] as const) {
      for (const s of seriesDe(r, v)) {
        expect(s.total, s.id).toBe(0);
        expect(s.graficable, s.id).toBe(false);
      }
    }
  });

  it('una dona con un solo valor distinto de cero es graficable y vale 100 %', () => {
    const s = serieSolicitudes(
      estadisticas({
        solicitudes: {
          total: 4,
          porEstado: { pendiente: 0, aprobada: 4, rechazada: 0, cancelada: 0 },
        },
      }),
    );
    expect(s.graficable).toBe(true);
    expect(s.filas.map((f) => f.porcentaje)).toEqual([0, 100, 0, 0]);
  });

  it('donaciones solo en especie: hay aportes (tabla) pero no hay monto que graficar', () => {
    const s = serieDonacionesPorMes(
      estadisticas({
        donaciones: {
          total: 1,
          porMes: [{ mes: '2026-10', cantidad: 1, monto: '0.00' }],
          porTipo: { economica: { cantidad: 0, monto: '0.00' }, especie: { cantidad: 1 } },
        },
      }),
    );
    expect(s.total).toBe(1);
    expect(s.graficable).toBe(false);
  });
});
