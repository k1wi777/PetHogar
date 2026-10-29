import { RAZAS_POR_ESPECIE, ROLES } from './catalogos.data';

describe('datos de catálogo', () => {
  it('define los tres roles', () => {
    expect([...ROLES]).toEqual(['administrador', 'fundacion', 'adoptante']);
  });

  it('incluye perro y gato, cada uno con «Mestizo» y sin duplicados', () => {
    expect(Object.keys(RAZAS_POR_ESPECIE).sort()).toEqual(['gato', 'perro']);
    for (const razas of Object.values(RAZAS_POR_ESPECIE)) {
      expect(razas).toContain('Mestizo');
      expect(new Set(razas).size).toBe(razas.length);
    }
  });
});
