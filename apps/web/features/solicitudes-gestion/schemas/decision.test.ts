import { describe, expect, it } from 'vitest';
import {
  MENSAJE_FECHA_OBLIGATORIA,
  MENSAJE_FECHA_PASADA,
  MENSAJE_FECHA_REAL,
  MENSAJE_MOTIVO,
  MENSAJE_OBSERVACION_LARGA,
  crearEsquemaDecision,
} from './decision';

const esquema = crearEsquemaDecision('2026-11-10');
const mensajes = (entrada: unknown) => {
  const r = esquema.safeParse(entrada);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('esquema de decisión', () => {
  it('aprobar exige la fecha de entrega', () => {
    expect(mensajes({ decision: 'aprobar', fechaEntrega: '' })).toEqual([
      MENSAJE_FECHA_OBLIGATORIA,
    ]);
    expect(mensajes({ decision: 'aprobar' })).toEqual([MENSAJE_FECHA_OBLIGATORIA]);
  });
  it('rechaza fechas irreales y pasadas, y acepta hoy (día de Bogotá) y futuras', () => {
    expect(mensajes({ decision: 'aprobar', fechaEntrega: '2026-02-30' })).toEqual([
      MENSAJE_FECHA_REAL,
    ]);
    expect(mensajes({ decision: 'aprobar', fechaEntrega: '2026-11-09' })).toEqual([
      MENSAJE_FECHA_PASADA,
    ]);
    expect(mensajes({ decision: 'aprobar', fechaEntrega: '2026-11-10' })).toEqual([]);
    expect(mensajes({ decision: 'aprobar', fechaEntrega: '2026-12-01' })).toEqual([]);
  });
  it('aprobar: la observación es opcional, en blanco no se envía y tiene tope', () => {
    const r = esquema.safeParse({
      decision: 'aprobar',
      fechaEntrega: '2026-11-10',
      observacion: '   ',
    });
    expect(r.success && r.data).toEqual({
      decision: 'aprobar',
      fechaEntrega: '2026-11-10',
      observacion: undefined,
    });
    expect(
      mensajes({ decision: 'aprobar', fechaEntrega: '2026-11-10', observacion: 'a'.repeat(301) }),
    ).toEqual([MENSAJE_OBSERVACION_LARGA]);
    expect(
      mensajes({ decision: 'aprobar', fechaEntrega: '2026-11-10', observacion: 'a'.repeat(300) }),
    ).toEqual([]);
  });
  it('rechazar exige observación de 1 a 300 y no pide fecha', () => {
    expect(mensajes({ decision: 'rechazar', observacion: '   ' })).toEqual([MENSAJE_MOTIVO]);
    expect(mensajes({ decision: 'rechazar' })).toEqual([MENSAJE_MOTIVO]);
    expect(mensajes({ decision: 'rechazar', observacion: 'a'.repeat(301) })).toEqual([
      MENSAJE_OBSERVACION_LARGA,
    ]);
    const r = esquema.safeParse({
      decision: 'rechazar',
      observacion: ' No cumple ',
      fechaEntrega: 'basura',
    });
    expect(r.success && r.data).toEqual({ decision: 'rechazar', observacion: 'No cumple' });
  });
  it('sin decisión elegida pide elegir', () => {
    expect(mensajes({})).toEqual(['Elige si quieres aprobar o rechazar la solicitud']);
  });
});
