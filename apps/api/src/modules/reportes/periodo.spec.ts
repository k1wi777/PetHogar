import { BadRequestException } from '@nestjs/common';
import { filtroDePeriodo } from './periodo';

describe('filtroDePeriodo', () => {
  it('sin fechas no limita el rango y conserva la fundación', () => {
    expect(filtroDePeriodo(4)).toEqual({
      fundacionId: 4,
      desde: undefined,
      hasta: undefined,
      desdeInstante: undefined,
      hastaExclusivo: undefined,
    });
  });

  it('ambos extremos incluidos: [00:00 Bogotá del primero, 00:00 Bogotá del día siguiente al último)', () => {
    const f = filtroDePeriodo(undefined, '2026-10-01', '2026-10-31');
    expect(f.desdeInstante?.toISOString()).toBe('2026-10-01T05:00:00.000Z');
    expect(f.hastaExclusivo?.toISOString()).toBe('2026-11-01T05:00:00.000Z');
    expect(f.desde).toBe('2026-10-01');
    expect(f.hasta).toBe('2026-10-31');
  });

  it('el mismo día es un rango válido de 24 horas', () => {
    const f = filtroDePeriodo(1, '2026-10-05', '2026-10-05');
    expect((f.hastaExclusivo as Date).getTime() - (f.desdeInstante as Date).getTime()).toBe(
      86_400_000,
    );
  });

  it('el rango invertido es 400 en español', () => {
    expect(() => filtroDePeriodo(1, '2026-10-05', '2026-10-01')).toThrow(BadRequestException);
    expect(() => filtroDePeriodo(1, '2026-10-05', '2026-10-01')).toThrow(
      'La fecha final no puede ser anterior a la inicial',
    );
  });
});
