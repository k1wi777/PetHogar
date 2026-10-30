import { describe, expect, it } from 'vitest';
import { fechaLarga } from './formato';

describe('fechaLarga', () => {
  it('formatea la fecha sin desplazarla por zona horaria', () => {
    expect(fechaLarga('2026-03-05')).toBe('5 de marzo de 2026');
    expect(fechaLarga('basura')).toBe('basura');
  });
});
