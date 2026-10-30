import { describe, expect, it } from 'vitest';
import {
  MENSAJE_FECHA_OBLIGATORIA,
  MENSAJE_FECHA_PASADA,
  MENSAJE_FECHA_REAL,
  MENSAJE_TIPO,
  crearEsquemaProgramar,
  mensajePosteriorAEntrega,
} from './programar';

const esquema = crearEsquemaProgramar('2026-11-20', '2026-12-01');
const mensajes = (e: unknown) => {
  const r = esquema.safeParse(e);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('esquema de programar seguimiento', () => {
  it('exige tipo y fecha', () => {
    expect(mensajes({})).toEqual([MENSAJE_TIPO, MENSAJE_FECHA_OBLIGATORIA]);
    expect(mensajes({ tipo: 'llamada', fechaProgramada: '2026-12-05' })).toEqual([MENSAJE_TIPO]);
  });
  it('la fecha igual a la entrega o anterior se rechaza con la fecha de entrega', () => {
    expect(mensajes({ tipo: 'visita', fechaProgramada: '2026-11-20' })).toEqual([
      mensajePosteriorAEntrega('2026-11-20'),
    ]);
    expect(mensajes({ tipo: 'visita', fechaProgramada: '2026-11-10' })).toEqual([
      mensajePosteriorAEntrega('2026-11-20'),
    ]);
  });
  it('una fecha posterior a la entrega pero pasada se rechaza', () => {
    expect(mensajes({ tipo: 'reporte', fechaProgramada: '2026-11-25' })).toEqual([
      MENSAJE_FECHA_PASADA,
    ]);
  });
  it('acepta hoy y futuras; rechaza fechas irreales', () => {
    expect(mensajes({ tipo: 'reporte', fechaProgramada: '2026-12-01' })).toEqual([]);
    expect(mensajes({ tipo: 'visita', fechaProgramada: '2027-01-15' })).toEqual([]);
    expect(mensajes({ tipo: 'visita', fechaProgramada: '2026-02-30' })).toEqual([
      MENSAJE_FECHA_REAL,
    ]);
  });
});
