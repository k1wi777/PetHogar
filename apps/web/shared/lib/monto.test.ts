import { describe, expect, it } from 'vitest';
import {
  MENSAJE_FORMATO_MONTO,
  MENSAJE_MONTO_MAXIMO,
  MENSAJE_MONTO_MAYOR_A_CERO,
  formatearMonto,
  mensajeDeProblema,
  normalizarMonto,
  problemaDeMonto,
} from './monto';

describe('monto compartido', () => {
  it('normaliza la coma decimal', () => {
    expect(normalizarMonto(' 5,5 ')).toBe('5.5');
  });
  it('valida con BigInt: formato, cero y tope', () => {
    expect(problemaDeMonto('50000.50')).toBeNull();
    expect(problemaDeMonto('1000000000')).toBeNull();
    expect(problemaDeMonto('1000000000.00')).toBeNull();
    expect(problemaDeMonto('1000000000.01')).toBe('maximo');
    expect(problemaDeMonto('0')).toBe('cero');
    expect(problemaDeMonto('0.00')).toBe('cero');
    expect(problemaDeMonto('1.234')).toBe('formato');
    expect(problemaDeMonto('1e5')).toBe('formato');
    expect(problemaDeMonto('')).toBe('formato');
    // Más de 15 cifras: con Number perdería precisión; con BigInt se compara exacto.
    expect(problemaDeMonto('9007199254740993')).toBe('maximo');
  });
  it('mensajes y formato de presentación', () => {
    expect(mensajeDeProblema('cero')).toBe(MENSAJE_MONTO_MAYOR_A_CERO);
    expect(mensajeDeProblema('maximo')).toBe(MENSAJE_MONTO_MAXIMO);
    expect(mensajeDeProblema('formato')).toBe(MENSAJE_FORMATO_MONTO);
    expect(formatearMonto('50000')).toBe('$ 50.000');
    expect(formatearMonto('50000.50')).toBe('$ 50.000,50');
    expect(formatearMonto('1000000000.00')).toBe('$ 1.000.000.000');
  });
});
