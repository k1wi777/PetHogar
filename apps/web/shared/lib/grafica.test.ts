import { describe, expect, it } from 'vitest';
import { razonContraste } from './contraste';
import {
  COLOR_FONDO_GRAFICA,
  COLOR_TRAZO_PATRON,
  OPACIDAD_TRAZO_PATRON,
  PALETA_GRAFICA,
  SEPARACION_REBANADAS_PX,
  estiloDeSerie,
} from './grafica';
import { TOKENS_COLOR } from './tokens';

/** Color resultante de dibujar `frente` con `opacidad` sobre `fondo` (ambos `#rrggbb`). */
function mezclar(frente: string, fondo: string, opacidad: number): string {
  const f = parseInt(frente.slice(1), 16);
  const g = parseInt(fondo.slice(1), 16);
  const canal = (n: number, desplazamiento: number) => (n >> desplazamiento) & 255;
  const mezcla = (desplazamiento: number) =>
    Math.round(opacidad * canal(f, desplazamiento) + (1 - opacidad) * canal(g, desplazamiento));
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(mezcla(16))}${hex(mezcla(8))}${hex(mezcla(0))}`;
}

describe('paleta de las gráficas', () => {
  it.each(PALETA_GRAFICA.map((e) => [e.color, e.patron] as const))(
    'el color %s (%s) supera 3:1 contra el fondo de la gráfica',
    (color) => {
      expect(razonContraste(color, COLOR_FONDO_GRAFICA)).toBeGreaterThanOrEqual(3);
    },
  );

  it('el fondo de la gráfica es el color de las tarjetas', () => {
    expect(COLOR_FONDO_GRAFICA).toBe(TOKENS_COLOR.card);
  });

  it('el texto de las etiquetas supera 4.5:1 contra el fondo', () => {
    expect(razonContraste(TOKENS_COLOR.foreground, COLOR_FONDO_GRAFICA)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it('el trazo del patrón, con su opacidad real, supera 3:1 contra cada color de relleno', () => {
    for (const { color } of PALETA_GRAFICA) {
      const visto = mezclar(COLOR_TRAZO_PATRON, color, OPACIDAD_TRAZO_PATRON);
      expect(razonContraste(visto, color), color).toBeGreaterThanOrEqual(3);
    }
  });

  // Medición real: entre rebanadas contiguas NO se alcanza 3:1 (ni se puede con 5 colores que
  // superen 3:1 contra blanco). WCAG 1.4.11 se cumple porque las separa un trazo de fondo de ≥ 2 px
  // (cuyo contraste con cada color sí es ≥ 3:1) y porque el patrón añade una segunda señal.
  it('registra el contraste real entre colores de la paleta: si cambia la paleta hay que revisar el argumento', () => {
    const razones: number[] = [];
    for (let i = 0; i < PALETA_GRAFICA.length; i++) {
      for (let j = i + 1; j < PALETA_GRAFICA.length; j++) {
        razones.push(razonContraste(PALETA_GRAFICA[i]!.color, PALETA_GRAFICA[j]!.color));
      }
    }
    expect(razones).toHaveLength(10);
    expect(Math.min(...razones)).toBeCloseTo(1.05, 1);
    expect(Math.max(...razones)).toBeCloseTo(2.16, 1);
    // Ningún par supera 3:1: por eso la separación es obligatoria, no decorativa.
    expect(razones.every((r) => r < 3)).toBe(true);
  });

  it('las rebanadas contiguas se separan con el color de fondo y al menos 2 px', () => {
    expect(SEPARACION_REBANADAS_PX).toBeGreaterThanOrEqual(2);
    expect(COLOR_FONDO_GRAFICA).toBe(TOKENS_COLOR.card);
    for (const { color } of PALETA_GRAFICA) {
      expect(razonContraste(color, COLOR_FONDO_GRAFICA), color).toBeGreaterThanOrEqual(3);
    }
  });

  it('cada serie tiene un patrón distinto y los colores no se repiten', () => {
    expect(new Set(PALETA_GRAFICA.map((e) => e.patron)).size).toBe(PALETA_GRAFICA.length);
    expect(new Set(PALETA_GRAFICA.map((e) => e.color)).size).toBe(PALETA_GRAFICA.length);
  });

  it('estiloDeSerie recorre la paleta en orden', () => {
    expect(estiloDeSerie(0)).toBe(PALETA_GRAFICA[0]);
    expect(estiloDeSerie(PALETA_GRAFICA.length)).toBe(PALETA_GRAFICA[0]);
  });
});
