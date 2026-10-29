import { esMayorDeEdad } from './mayoria-edad';

describe('esMayorDeEdad', () => {
  const ahora = new Date('2026-10-29T12:00:00Z');

  it('acepta a quien cumple 18 hoy', () => {
    expect(esMayorDeEdad('2008-10-29', ahora)).toBe(true);
  });

  it('rechaza a quien cumple 18 mañana', () => {
    expect(esMayorDeEdad('2008-10-30', ahora)).toBe(false);
  });

  it('rechaza a un menor y acepta a un adulto', () => {
    expect(esMayorDeEdad('2015-01-01', ahora)).toBe(false);
    expect(esMayorDeEdad('1990-05-20', ahora)).toBe(true);
  });

  it('rechaza una fecha de nacimiento futura', () => {
    expect(esMayorDeEdad('2030-01-01', ahora)).toBe(false);
  });

  it('considera el mes: cumpleaños posterior en el año aún no cumplido', () => {
    expect(esMayorDeEdad('2008-12-01', ahora)).toBe(false);
    expect(esMayorDeEdad('2008-09-30', ahora)).toBe(true);
  });
});
