import { diasEntre, esFechaCalendario, hoyEnBogota, inicioDelDiaEnBogota } from './fecha';

describe('fechas de Bogotá', () => {
  it('hoyEnBogota cambia de día a las 05:00Z', () => {
    expect(hoyEnBogota(new Date('2026-03-10T04:59:59Z'))).toBe('2026-03-09');
    expect(hoyEnBogota(new Date('2026-03-10T05:00:00Z'))).toBe('2026-03-10');
  });

  it('inicioDelDiaEnBogota es la medianoche local (05:00Z) y vuelve al mismo día', () => {
    const inicio = inicioDelDiaEnBogota('2026-12-01');
    expect(inicio.toISOString()).toBe('2026-12-01T05:00:00.000Z');
    expect(hoyEnBogota(inicio)).toBe('2026-12-01');
    expect(hoyEnBogota(new Date(inicio.getTime() - 1))).toBe('2026-11-30');
  });

  it('diasEntre cuenta días de calendario, también entre meses y años', () => {
    expect(diasEntre('2026-03-10', '2026-03-10')).toBe(0);
    expect(diasEntre('2026-03-10', '2026-03-13')).toBe(3);
    expect(diasEntre('2026-12-30', '2027-01-02')).toBe(3);
    expect(diasEntre('2026-03-13', '2026-03-10')).toBe(-3);
  });

  it('esFechaCalendario rechaza días inexistentes', () => {
    expect(esFechaCalendario('2026-02-28')).toBe(true);
    expect(esFechaCalendario('2026-02-30')).toBe(false);
    expect(esFechaCalendario('26-02-28')).toBe(false);
  });
});
