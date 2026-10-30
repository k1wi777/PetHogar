import { describe, expect, it } from 'vitest';
import {
  MAX_OBSERVACION,
  MENSAJE_MOTIVO,
  MENSAJE_OBSERVACION_LARGA,
  esquemaValidacion,
} from './decision';

describe('esquemaValidacion', () => {
  it('rechazar exige observación (ausente o en blanco)', () => {
    for (const observacion of [undefined, '', '   ']) {
      const r = esquemaValidacion.safeParse({ decision: 'rechazada', observacion });
      expect(r.success).toBe(false);
      expect(r.error?.issues[0]?.message).toBe(MENSAJE_MOTIVO);
    }
  });
  it('rechazar con motivo recorta y acepta hasta 300 caracteres', () => {
    expect(esquemaValidacion.parse({ decision: 'rechazada', observacion: '  Sin NIT  ' })).toEqual({
      decision: 'rechazada',
      observacion: 'Sin NIT',
    });
    expect(
      esquemaValidacion.safeParse({ decision: 'rechazada', observacion: 'a'.repeat(300) }).success,
    ).toBe(true);
    const r = esquemaValidacion.safeParse({
      decision: 'rechazada',
      observacion: 'a'.repeat(MAX_OBSERVACION + 1),
    });
    expect(r.error?.issues[0]?.message).toBe(MENSAJE_OBSERVACION_LARGA);
  });
  it('aprobar admite observación vacía (se omite) o con texto', () => {
    expect(esquemaValidacion.parse({ decision: 'aprobada', observacion: '' })).toEqual({
      decision: 'aprobada',
      observacion: undefined,
    });
    expect(esquemaValidacion.parse({ decision: 'aprobada', observacion: 'Bienvenidos' })).toEqual({
      decision: 'aprobada',
      observacion: 'Bienvenidos',
    });
    expect(
      esquemaValidacion.safeParse({ decision: 'aprobada', observacion: 'a'.repeat(301) }).success,
    ).toBe(false);
  });
});
