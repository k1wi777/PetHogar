import { describe, expect, it } from 'vitest';
import { esVencido, estadoVisible } from '@/shared/lib/seguimiento';
import { admiteReporte, leerId, rutaSeguimiento } from './seguimiento';

describe('seguimiento', () => {
  it('vencido por estado o por fecha aunque el estado siga programado', () => {
    expect(esVencido({ estado: 'vencido', vencido: true })).toBe(true);
    expect(esVencido({ estado: 'programado', vencido: true })).toBe(true);
    expect(esVencido({ estado: 'programado', vencido: false })).toBe(false);
    expect(esVencido({ estado: 'realizado', vencido: true })).toBe(false);
    expect(estadoVisible({ estado: 'programado', vencido: true })).toBe('vencido');
    expect(estadoVisible({ estado: 'cancelado', vencido: false })).toBe('cancelado');
  });
  it('solo un reporte programado o vencido admite reporte', () => {
    expect(admiteReporte({ tipo: 'reporte', estado: 'programado', vencido: false })).toBe(true);
    expect(admiteReporte({ tipo: 'reporte', estado: 'vencido', vencido: true })).toBe(true);
    expect(admiteReporte({ tipo: 'visita', estado: 'programado', vencido: false })).toBe(false);
    expect(admiteReporte({ tipo: 'reporte', estado: 'realizado', vencido: false })).toBe(false);
    expect(admiteReporte({ tipo: 'reporte', estado: 'cancelado', vencido: false })).toBe(false);
  });
  it('ruta e id', () => {
    expect(rutaSeguimiento(4)).toBe('/adoptante/adopciones/seguimientos/4');
    expect(leerId('4')).toBe(4);
    expect(leerId('x')).toBeNull();
    expect(leerId('0')).toBeNull();
  });
});
