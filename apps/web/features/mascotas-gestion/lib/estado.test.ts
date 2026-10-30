import { describe, expect, it } from 'vitest';
import { ESTADOS_MASCOTA, type EstadoMascota } from '../types';
import { explicacionSinBaja, explicacionSoloLectura, puedeDarDeBaja, puedeEditar } from './estado';

describe('acciones por estado (espejo de la máquina del backend, origen fundación)', () => {
  const tabla: Array<[EstadoMascota, boolean, boolean]> = [
    ['disponible', true, true],
    ['en_proceso', true, false],
    ['adoptada', false, false],
    ['inactiva', false, false],
  ];

  it.each(tabla)('%s: editar=%s, dar de baja=%s', (estado, editar, baja) => {
    expect(puedeEditar(estado)).toBe(editar);
    expect(puedeDarDeBaja(estado)).toBe(baja);
  });

  it('la tabla cubre todos los estados', () => {
    expect(tabla.map((t) => t[0]).sort()).toEqual([...ESTADOS_MASCOTA].sort());
  });

  it('cada estado sin acción explica por qué, y los que sí la tienen no muestran razón', () => {
    expect(explicacionSinBaja('disponible')).toBeNull();
    expect(explicacionSoloLectura('disponible')).toBeNull();
    expect(explicacionSoloLectura('en_proceso')).toBeNull();
    expect(explicacionSinBaja('en_proceso')).toMatch(/solicitud en curso/);
    expect(explicacionSinBaja('adoptada')).toMatch(/adoptada/);
    expect(explicacionSoloLectura('adoptada')).toMatch(/adoptada/);
    expect(explicacionSinBaja('inactiva')).toMatch(/no puede reactivarse/);
    expect(explicacionSoloLectura('inactiva')).toMatch(/dada de baja/);
  });
});
