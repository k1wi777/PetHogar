import { describe, expect, it } from 'vitest';
import {
  etiquetaSexo,
  etiquetaTamano,
  etiquetaTipoHistorial,
  formatearEdad,
} from './formato-mascota';

describe('formatearEdad', () => {
  it('cubre meses y años en la tarjeta', () => {
    expect(formatearEdad(0)).toBe('Menos de un mes');
    expect(formatearEdad(1)).toBe('1 mes');
    expect(formatearEdad(11)).toBe('11 meses');
    expect(formatearEdad(18)).toBe('18 meses');
    expect(formatearEdad(24)).toBe('2 años');
    expect(formatearEdad(35)).toBe('2 años');
  });

  it('detalla años y meses en la ficha', () => {
    expect(formatearEdad(5, true)).toBe('5 meses');
    expect(formatearEdad(12, true)).toBe('1 año');
    expect(formatearEdad(13, true)).toBe('1 año y 1 mes');
    expect(formatearEdad(30, true)).toBe('2 años y 6 meses');
  });
});

describe('etiquetas', () => {
  it('capitaliza y traduce', () => {
    expect(etiquetaTamano('pequeño')).toBe('Pequeño');
    expect(etiquetaSexo('hembra')).toBe('Hembra');
    expect(etiquetaTipoHistorial('desparasitacion')).toBe('Desparasitación');
    expect(etiquetaTipoHistorial('cirugia')).toBe('Cirugía');
  });
});
