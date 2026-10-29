import { edadLegible, plantillaFicha, type DatosFicha } from './ficha';

const FICHA = {
  id: 7,
  nombre: 'Peñita',
  especie: 'perro',
  raza: 'Mestizo',
  sexo: 'hembra',
  edadMeses: 27,
  tamano: 'pequeño',
  color: null,
  esterilizado: true,
  vacunado: false,
  estadoSalud: 'Sano y ágil',
  descripcion: 'Cariñosa y juguetona; le encanta el parque.',
  fechaPublicacion: new Date('2026-10-01T10:00:00Z'),
  fundacion: { id: 2, nombre: 'Fundación Patitas', ciudad: 'Montería', descripcion: null },
  fotos: [],
  historial: [
    { id: 1, tipo: 'vacuna', fecha: '2026-09-01', descripcion: 'Rabia', veterinario: 'Dra. Muñoz' },
    {
      id: 2,
      tipo: 'cirugia',
      fecha: '2026-09-10',
      descripcion: 'Esterilización',
      veterinario: null,
    },
  ],
} as unknown as DatosFicha['ficha'];

const base = (extra: Partial<DatosFicha> = {}): DatosFicha => ({
  ficha: FICHA,
  foto: null,
  generadoEn: new Date('2026-10-29T15:00:00Z'),
  logoSvg: '<svg/>',
  ...extra,
});
const texto = (d: unknown): string => JSON.stringify(d);

describe('edadLegible', () => {
  it.each([
    [0, '0 meses'],
    [1, '1 mes'],
    [8, '8 meses'],
    [12, '1 año'],
    [24, '2 años'],
    [27, '2 años y 3 meses'],
    [13, '1 año y 1 mes'],
  ])('%i meses → %s', (meses, esperado) => expect(edadLegible(meses)).toBe(esperado));
});

describe('plantillaFicha', () => {
  it('muestra los datos públicos con acentos y ñ, el historial y la fundación', () => {
    const t = texto(plantillaFicha(base()));
    for (const esperado of [
      'Ficha de Peñita',
      'Perro',
      '2 años y 3 meses',
      'Pequeño',
      'Cariñosa y juguetona',
      'Rabia',
      'Dra. Muñoz',
      'Cirugía',
      'Fundación Patitas · Montería',
      'Sin foto',
    ]) {
      expect(t).toContain(esperado);
    }
    expect(t).toContain('Sin filtros');
  });

  it('con foto incrusta la imagen como data URL', () => {
    const t = texto(
      plantillaFicha(base({ foto: { buffer: Buffer.from('abc'), tipo: 'image/png' } })),
    );
    expect(t).toContain('data:image/png;base64,YWJj');
    expect(t).not.toContain('Sin foto');
  });

  it('sin historial lo indica y no incluye datos sensibles de la fundación', () => {
    const sucia = {
      ...FICHA,
      historial: [],
      fundacion: { ...FICHA.fundacion, nit: '900', correo: 'f@x.co', telefono: '300' },
    };
    const t = texto(plantillaFicha(base({ ficha: sucia as never })));
    expect(t).toContain('Sin eventos registrados');
    expect(t).not.toMatch(/900|f@x\.co|300/);
  });
});
