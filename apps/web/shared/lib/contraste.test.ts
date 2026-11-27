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

describe('patrón de fondo (R2, R5)', () => {
  const svg = readFileSync(join(process.cwd(), 'public/fondo/patron-huellitas.svg'), 'utf8');
  const opacidad = Number(/\sopacity="([\d.]+)"/.exec(svg)?.[1]);
  // Color que resulta donde el trazo `primary` cae sobre `background`.
  const mezcla = `#${[1, 3, 5]
    .map((i) => {
      const trazo = parseInt(TOKENS_COLOR.primary.slice(i, i + 2), 16);
      const fondo = parseInt(TOKENS_COLOR.background.slice(i, i + 2), 16);
      return Math.round(fondo + (trazo - fondo) * opacidad)
        .toString(16)
        .padStart(2, '0');
    })
    .join('')}`;

  it('usa el trazo ciruela con una opacidad entre 4 % y 6 %', () => {
    expect(svg).toContain(`stroke="${TOKENS_COLOR.primary}"`);
    expect(opacidad).toBeGreaterThanOrEqual(0.04);
    expect(opacidad).toBeLessThanOrEqual(0.06);
  });

  it.each(['foreground', 'muted-foreground', 'primary', 'destructive'] as const)(
    'texto %s sobre el trazo cumple 4.5:1',
    (texto) => {
      expect(razonContraste(TOKENS_COLOR[texto], mezcla)).toBeGreaterThanOrEqual(4.5);
    },
  );
});
