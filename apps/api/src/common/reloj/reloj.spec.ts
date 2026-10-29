import { Reloj, RelojSistema } from './reloj';

describe('RelojSistema', () => {
  it('devuelve el instante actual', () => {
    const reloj: Reloj = new RelojSistema();
    const antes = Date.now();
    const ahora = reloj.ahora().getTime();
    expect(ahora).toBeGreaterThanOrEqual(antes);
    expect(ahora).toBeLessThanOrEqual(Date.now());
  });
});
