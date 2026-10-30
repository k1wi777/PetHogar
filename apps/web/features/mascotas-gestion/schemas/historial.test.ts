import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MENSAJE_FECHA_FUTURA,
  MENSAJE_FECHA_REAL,
  aDatosHistorial,
  esFechaReal,
  esquemaHistorial,
  hoyBogota,
} from './historial';

const valido = { tipo: 'vacuna', fecha: '2026-03-05', descripcion: 'Dosis', veterinario: '' };
const errores = (parcial: Record<string, unknown>) => {
  const r = esquemaHistorial.safeParse({ ...valido, ...parcial });
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

afterEach(() => vi.useRealTimers());

describe('hoyBogota', () => {
  it('usa la fecha de Bogotá (UTC-5), no la de UTC', () => {
    // 03:00 UTC del 30 es todavía el 29 a las 22:00 en Bogotá.
    expect(hoyBogota(new Date('2026-10-30T03:00:00Z'))).toBe('2026-10-29');
    expect(hoyBogota(new Date('2026-10-30T05:00:00Z'))).toBe('2026-10-30');
  });
});

describe('esFechaReal', () => {
  it('rechaza fechas que no existen o con otro formato', () => {
    expect(esFechaReal('2026-02-28')).toBe(true);
    expect(esFechaReal('2028-02-29')).toBe(true);
    expect(esFechaReal('2026-02-30')).toBe(false);
    expect(esFechaReal('2026-13-01')).toBe(false);
    expect(esFechaReal('05/03/2026')).toBe(false);
    expect(esFechaReal('')).toBe(false);
  });
});

describe('esquemaHistorial', () => {
  it('acepta un registro válido', () => {
    expect(errores({})).toEqual([]);
  });

  it('rechaza una fecha futura en Bogotá pero acepta hoy', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-30T03:00:00Z')); // en Bogotá aún es 29
    expect(errores({ fecha: '2026-10-29' })).toEqual([]);
    expect(errores({ fecha: '2026-10-30' })).toEqual([`fecha: ${MENSAJE_FECHA_FUTURA}`]);
  });

  it('rechaza fechas irreales y vacías', () => {
    expect(errores({ fecha: '2026-02-30' })).toEqual([`fecha: ${MENSAJE_FECHA_REAL}`]);
    expect(errores({ fecha: '' })).toEqual([`fecha: ${MENSAJE_FECHA_REAL}`]);
  });

  it('valida tipo, descripción (1 a 300) y veterinario (hasta 100)', () => {
    expect(errores({ tipo: 'baño' })[0]).toContain('tipo:');
    expect(errores({ descripcion: '  ' })).toContain('descripcion: La descripción es obligatoria');
    expect(errores({ descripcion: 'a'.repeat(300) })).toEqual([]);
    expect(errores({ descripcion: 'a'.repeat(301) })[0]).toContain('300');
    expect(errores({ veterinario: 'v'.repeat(100) })).toEqual([]);
    expect(errores({ veterinario: 'v'.repeat(101) })[0]).toContain('100');
  });

  it('omite el veterinario vacío al enviar', () => {
    expect(aDatosHistorial({ ...valido, tipo: 'cirugia', veterinario: ' ' })).toEqual({
      tipo: 'cirugia',
      fecha: '2026-03-05',
      descripcion: 'Dosis',
    });
    expect(
      aDatosHistorial({ ...valido, tipo: 'consulta', veterinario: ' Dr. X ' }).veterinario,
    ).toBe('Dr. X');
  });
});

describe('todos los errores a la vez', () => {
  it('un tipo vacío no oculta el error de una fecha futura', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-30T15:00:00Z'));
    const r = errores({ tipo: '', fecha: '2027-01-01' });
    expect(r).toEqual([expect.stringMatching(/^tipo:/), `fecha: ${MENSAJE_FECHA_FUTURA}`]);
  });
});
