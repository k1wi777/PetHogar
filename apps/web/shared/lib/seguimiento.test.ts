import { describe, expect, it } from 'vitest';
import { esVencido, estadoVisible } from './seguimiento';

describe('seguimiento compartido', () => {
  it('vencido por estado o por fecha aunque el estado siga programado', () => {
    expect(esVencido({ estado: 'vencido', vencido: true })).toBe(true);
    expect(esVencido({ estado: 'programado', vencido: true })).toBe(true);
    expect(esVencido({ estado: 'programado', vencido: false })).toBe(false);
    expect(esVencido({ estado: 'realizado', vencido: true })).toBe(false);
    expect(estadoVisible({ estado: 'programado', vencido: true })).toBe('vencido');
    expect(estadoVisible({ estado: 'cancelado', vencido: false })).toBe('cancelado');
  });
});
