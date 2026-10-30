import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { razonContraste } from './contraste';
import { PARES_NO_TEXTO, PARES_TEXTO, TOKENS_COLOR } from './tokens';

describe('razonContraste', () => {
  it('calcula los extremos y un caso conocido', () => {
    expect(razonContraste('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(razonContraste('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(razonContraste('#767676', '#ffffff')).toBeGreaterThan(4.5);
  });
});

describe('tokens de color (R1)', () => {
  it.each(PARES_TEXTO)('texto %s sobre %s cumple 4.5:1', (texto, fondo) => {
    expect(razonContraste(TOKENS_COLOR[texto], TOKENS_COLOR[fondo])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(PARES_NO_TEXTO)('%s contra %s cumple 3:1', (a, b) => {
    expect(razonContraste(TOKENS_COLOR[a], TOKENS_COLOR[b])).toBeGreaterThanOrEqual(3);
  });

  it('globals.css repite exactamente los valores de tokens.ts', () => {
    const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');
    for (const [nombre, hex] of Object.entries(TOKENS_COLOR)) {
      expect(css, nombre).toMatch(new RegExp(`--${nombre}:\\s*${hex};`, 'i'));
    }
  });
});
