import { describe, expect, it } from 'vitest';
import { formatearFecha } from './fechas';

describe('formatearFecha', () => {
  it('formatea AAAA-MM-DD sin desfase de zona', () => {
    expect(formatearFecha('2026-12-15')).toBe('15 de diciembre de 2026');
    expect(formatearFecha('2026-01-01')).toBe('1 de enero de 2026');
  });
  it('formatea un instante ISO', () => {
    expect(formatearFecha('2026-06-10T12:00:00.000Z')).toMatch(/^\d{1,2} de junio de 2026$/);
  });
  it('devuelve el valor si no lo reconoce', () => {
    expect(formatearFecha('mañana')).toBe('mañana');
    expect(formatearFecha('2026-13-01')).toBe('2026-13-01');
  });
});
