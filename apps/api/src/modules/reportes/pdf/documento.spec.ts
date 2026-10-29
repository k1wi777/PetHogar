import { avisoDeFilas, celda, documento, encabezado, fechaLegible, filtro } from './documento';

const BASE = {
  titulo: 'Solicitudes de adopción',
  generadoEn: new Date('2026-10-29T15:30:00Z'),
  logoSvg: '<svg/>',
};
const texto = (x: unknown): string => JSON.stringify(x);

describe('encabezado común', () => {
  it('incluye logo, título, fecha de generación en hora de Bogotá y los filtros aplicados', () => {
    const e = texto(
      encabezado({
        ...BASE,
        filtros: [filtro('Estado', 'pendiente'), null, filtro('Desde', '2026-10-01')],
      }),
    );
    expect(e).toContain('"svg":"<svg/>"');
    expect(e).toContain('Solicitudes de adopción');
    expect(e).toContain('Generado el 29 de octubre de 2026');
    expect(e).toContain('10:30');
    expect(e).toContain('Filtros: Estado: pendiente · Desde: 2026-10-01');
  });

  it('sin filtros lo indica', () => {
    expect(texto(encabezado({ ...BASE, filtros: [null, null] }))).toContain('Sin filtros');
  });
});

describe('documento', () => {
  it('es A4, antepone el encabezado y numera las páginas', () => {
    const d = documento({ ...BASE, filtros: [], contenido: [{ text: 'cuerpo' }] });
    expect(d.pageSize).toBe('A4');
    expect(Array.isArray(d.content) && d.content).toHaveLength(2);
    const pie = (d.footer as (p: number, t: number) => unknown)(2, 5);
    expect(texto(pie)).toContain('Página 2 de 5');
  });
});

describe('utilidades', () => {
  it('fechaLegible usa la hora de Bogotá', () => {
    expect(fechaLegible(new Date('2026-10-30T03:00:00Z'))).toContain('29 de octubre de 2026');
  });

  it('avisoDeFilas: sin resultados, recortado o completo', () => {
    expect(texto(avisoDeFilas(0, 0))).toContain('Sin resultados');
    expect(texto(avisoDeFilas(1000, 1500))).toContain('primeras 1000 de 1500');
    expect(texto(avisoDeFilas(3, 3))).not.toContain('Sin resultados');
  });

  it('celda nunca devuelve undefined o vacío', () => {
    expect(celda(null)).toBe('—');
    expect(celda(undefined)).toBe('—');
    expect(celda('')).toBe('—');
    expect(celda(0)).toBe('0');
    expect(celda('Niño')).toBe('Niño');
  });
});
