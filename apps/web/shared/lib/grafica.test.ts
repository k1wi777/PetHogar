import { describe, expect, it } from 'vitest';
import { razonContraste } from './contraste';
import {
  COLOR_FONDO_GRAFICA,
  PALETA_GRAFICA,
  SEPARACION_REBANADAS_PX,
  estiloDeSerie,
} from './grafica';
import { TOKENS_COLOR } from './tokens';

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

  it('cada par adyacente (la última con la primera) se distingue por contraste ≥ 3:1 o por separación', () => {
    for (let i = 0; i < PALETA_GRAFICA.length; i++) {
      const a = PALETA_GRAFICA[i]!;
      const b = PALETA_GRAFICA[(i + 1) % PALETA_GRAFICA.length]!;
      const entreSi = razonContraste(a.color, b.color) >= 3;
      const separadas =
        SEPARACION_REBANADAS_PX >= 2 &&
        razonContraste(a.color, COLOR_FONDO_GRAFICA) >= 3 &&
        razonContraste(b.color, COLOR_FONDO_GRAFICA) >= 3;
      expect(entreSi || separadas, `${a.color} / ${b.color}`).toBe(true);
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
