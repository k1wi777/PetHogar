import { describe, expect, it } from 'vitest';
import {
  esFechaReal,
  formatearFecha,
  formatearFechaBogota,
  hoyEnBogota,
  primerDiaDelMes,
  restarDias,
  sumarDias,
  ultimoDiaDelMes,
} from './fechas';

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

describe('fechas de Bogotá', () => {
  it('hoyEnBogota usa la zona de Bogotá aunque el instante cambie de día en UTC', () => {
    // 2026-03-01 03:30 UTC es todavía el 28 de febrero a las 22:30 en Bogotá (UTC-5).
    expect(hoyEnBogota(new Date('2026-03-01T03:30:00Z'))).toBe('2026-02-28');
    expect(hoyEnBogota(new Date('2026-03-01T05:00:00Z'))).toBe('2026-03-01');
    expect(hoyEnBogota(new Date('2026-12-31T23:59:00-05:00'))).toBe('2026-12-31');
  });
  it('hoyEnBogota no depende de la zona del navegador', () => {
    const previa = process.env.TZ;
    process.env.TZ = 'Pacific/Auckland';
    try {
      expect(hoyEnBogota(new Date('2026-06-10T03:00:00Z'))).toBe('2026-06-09');
    } finally {
      process.env.TZ = previa;
    }
  });
  it('formatearFechaBogota muestra el día de Bogotá y la hora', () => {
    expect(formatearFechaBogota('2026-03-01T03:30:00Z')).toMatch(
      /^28 de febrero de 2026, 10:30\s?p\. m\.$/i,
    );
    expect(formatearFechaBogota('nada')).toBe('nada');
  });
  it('esFechaReal valida el calendario', () => {
    expect(esFechaReal('2026-02-28')).toBe(true);
    expect(esFechaReal('2028-02-29')).toBe(true);
    expect(esFechaReal('2026-02-29')).toBe(false);
    expect(esFechaReal('2026-02-30')).toBe(false);
    expect(esFechaReal('2026-13-01')).toBe(false);
    expect(esFechaReal('26-1-1')).toBe(false);
  });
  it('operaciones de periodo sobre cadenas', () => {
    expect(restarDias('2026-03-01', 1)).toBe('2026-02-28');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(primerDiaDelMes('2026-03-17')).toBe('2026-03-01');
    expect(ultimoDiaDelMes('2026-02-10')).toBe('2026-02-28');
    expect(ultimoDiaDelMes('2028-02-10')).toBe('2028-02-29');
  });
});
