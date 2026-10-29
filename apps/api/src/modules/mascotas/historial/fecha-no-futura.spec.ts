import { esFechaCalendario, fechaNoFutura, hoyEnBogota } from './fecha-no-futura';

describe('fecha no futura (America/Bogota)', () => {
  it('compara con el día de Bogotá, no con el de UTC', () => {
    // 2026-03-10 02:00 UTC = 2026-03-09 21:00 en Bogotá (UTC-5).
    const ahora = new Date('2026-03-10T02:00:00Z');
    expect(hoyEnBogota(ahora)).toBe('2026-03-09');
    expect(fechaNoFutura('2026-03-09', ahora)).toBe(true);
    expect(fechaNoFutura('2026-03-10', ahora)).toBe(false);
  });

  it('en el límite de medianoche de Bogotá cambia el día', () => {
    expect(hoyEnBogota(new Date('2026-03-10T04:59:59Z'))).toBe('2026-03-09');
    expect(hoyEnBogota(new Date('2026-03-10T05:00:00Z'))).toBe('2026-03-10');
    expect(fechaNoFutura('2026-03-10', new Date('2026-03-10T05:00:00Z'))).toBe(true);
  });

  it('acepta fechas pasadas y rechaza futuras', () => {
    const ahora = new Date('2026-06-15T12:00:00Z');
    expect(fechaNoFutura('2020-01-01', ahora)).toBe(true);
    expect(fechaNoFutura('2026-06-15', ahora)).toBe(true);
    expect(fechaNoFutura('2026-06-16', ahora)).toBe(false);
    expect(fechaNoFutura('2027-01-01', ahora)).toBe(false);
  });

  it('reconoce fechas reales del calendario', () => {
    expect(esFechaCalendario('2024-02-29')).toBe(true);
    expect(esFechaCalendario('2026-02-29')).toBe(false);
    expect(esFechaCalendario('2026-02-30')).toBe(false);
    expect(esFechaCalendario('2026-13-01')).toBe(false);
    expect(esFechaCalendario('2026-00-10')).toBe(false);
    expect(esFechaCalendario('2026-1-1')).toBe(false);
    expect(esFechaCalendario('26-01-01')).toBe(false);
    expect(esFechaCalendario('0050-01-01')).toBe(true);
    expect(esFechaCalendario('2026-01-01T00:00:00Z')).toBe(false);
    expect(esFechaCalendario('')).toBe(false);
  });
});
