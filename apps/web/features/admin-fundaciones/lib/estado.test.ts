import { describe, expect, it } from 'vitest';
import { decisionesPosibles } from './estado';

describe('decisiones posibles por estado', () => {
  it('espeja las transiciones del backend', () => {
    expect(decisionesPosibles('pendiente')).toEqual(['aprobada', 'rechazada']);
    expect(decisionesPosibles('rechazada')).toEqual(['aprobada']);
    expect(decisionesPosibles('aprobada')).toEqual([]);
  });
});
