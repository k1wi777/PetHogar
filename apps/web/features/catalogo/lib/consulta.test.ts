import { describe, expect, it } from 'vitest';
import { aConsultaApi, hayFiltros, parsearFiltros, urlCatalogo } from './consulta';

describe('parsearFiltros', () => {
  it('lee filtros válidos de la URL', () => {
    const { filtros, rangoInvalido } = parsearFiltros({
      especie: '2',
      tamano: 'pequeño',
      edadMin: '6',
      edadMax: '24',
      ciudad: '  Montería ',
      pagina: '3',
    });
    expect(filtros).toEqual({
      especie: 2,
      tamano: 'pequeño',
      edadMin: 6,
      edadMax: 24,
      ciudad: 'Montería',
      pagina: 3,
    });
    expect(rangoInvalido).toBe(false);
  });

  it('descarta valores vacíos, no numéricos, negativos o desconocidos', () => {
    const { filtros } = parsearFiltros({
      especie: 'abc',
      tamano: 'enorme',
      edadMin: '-1',
      edadMax: '1.5',
      ciudad: '   ',
      pagina: '0',
    });
    expect(filtros).toEqual({ pagina: 1 });
    expect(hayFiltros(filtros)).toBe(false);
  });

  it('descarta edades por encima del máximo de la API y toma el primer valor repetido', () => {
    const { filtros } = parsearFiltros({ edadMax: '361', tamano: ['grande', 'mediano'] });
    expect(filtros.edadMax).toBeUndefined();
    expect(filtros.tamano).toBe('grande');
  });

  it('marca el rango incoherente', () => {
    expect(parsearFiltros({ edadMin: '30', edadMax: '10' }).rangoInvalido).toBe(true);
    expect(parsearFiltros({ edadMin: '10', edadMax: '10' }).rangoInvalido).toBe(false);
  });
});

describe('aConsultaApi', () => {
  it('traduce a los nombres de la API', () => {
    const { filtros } = parsearFiltros({ especie: '1', edadMin: '3', edadMax: '9', pagina: '2' });
    expect(aConsultaApi(filtros, false)).toEqual({
      especieId: 1,
      tamano: undefined,
      edadMinMeses: 3,
      edadMaxMeses: 9,
      ciudad: undefined,
      page: 2,
    });
  });

  it('envía el tamaño y la ciudad válidos', () => {
    const { filtros } = parsearFiltros({ tamano: 'grande', ciudad: 'Cali' });
    expect(aConsultaApi(filtros, false)).toMatchObject({ tamano: 'grande', ciudad: 'Cali' });
  });

  it('no envía el rango incoherente ni la página 1', () => {
    const { filtros, rangoInvalido } = parsearFiltros({ edadMin: '30', edadMax: '10' });
    const consulta = aConsultaApi(filtros, rangoInvalido);
    expect(consulta.edadMinMeses).toBeUndefined();
    expect(consulta.edadMaxMeses).toBeUndefined();
    expect(consulta.page).toBeUndefined();
  });
});

describe('urlCatalogo', () => {
  it('reconstruye la URL y reproduce los mismos filtros', () => {
    const original = {
      especie: 2,
      tamano: 'mediano',
      ciudad: 'Cali',
      edadMin: 0,
      pagina: 4,
    } as const;
    const url = urlCatalogo(original);
    expect(url).toBe('/adoptar?especie=2&tamano=mediano&edadMin=0&ciudad=Cali&pagina=4');
    const params = Object.fromEntries(new URL(url, 'http://x').searchParams);
    expect(parsearFiltros(params).filtros).toEqual(original);
  });

  it('omite la página 1 y los filtros vacíos, y permite cambiar de página', () => {
    expect(urlCatalogo({ pagina: 1 })).toBe('/adoptar');
    expect(urlCatalogo({ tamano: 'grande', pagina: 3 }, 2)).toBe('/adoptar?tamano=grande&pagina=2');
    expect(urlCatalogo({ tamano: 'grande', pagina: 3 }, 1)).toBe('/adoptar?tamano=grande');
  });
});
