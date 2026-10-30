import { describe, expect, it } from 'vitest';
import { evaluarFortaleza } from './fortaleza';

const cumplidos = (c: string) =>
  evaluarFortaleza(c)
    .criterios.filter((x) => x.cumplido)
    .map((x) => x.clave);

describe('evaluarFortaleza', () => {
  it('vacía no cumple nada', () => {
    const r = evaluarFortaleza('');
    expect(r.nivel).toBe('vacia');
    expect(r.criterios.every((c) => !c.cumplido)).toBe(true);
  });

  it('marca cada criterio de la política', () => {
    expect(cumplidos('abc')).toEqual(['minuscula']);
    expect(cumplidos('ABC1')).toEqual(['mayuscula', 'numero']);
    expect(cumplidos('Abcdefg1')).toEqual(['longitud', 'mayuscula', 'minuscula', 'numero']);
  });

  it('la longitud acepta 8 y 64 y rechaza 7 y 65', () => {
    const longitud = (n: number) =>
      evaluarFortaleza(`Aa1${'x'.repeat(n - 3)}`).criterios[0]!.cumplido;
    expect(longitud(7)).toBe(false);
    expect(longitud(8)).toBe(true);
    expect(longitud(64)).toBe(true);
    expect(longitud(65)).toBe(false);
  });

  it('niveles: débil si falta un criterio, media con 8 a 11 y fuerte desde 12', () => {
    expect(evaluarFortaleza('abcdefgh').nivel).toBe('debil');
    expect(evaluarFortaleza('Abcdefg1').nivel).toBe('media');
    expect(evaluarFortaleza('Abcdefghij1').nivel).toBe('media');
    expect(evaluarFortaleza('Abcdefghijk1').nivel).toBe('fuerte');
    expect(evaluarFortaleza(`Aa1${'x'.repeat(70)}`).nivel).toBe('debil');
  });
});
