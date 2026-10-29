import { TipoDonacion } from '../../../donaciones/entities/donacion.enum';
import {
  EstadoBienestar,
  EstadoSeguimiento,
} from '../../../seguimientos/entities/seguimiento.enum';
import { EstadoSolicitud } from '../../../solicitudes/entities/solicitud-adopcion.enum';
import {
  pesos,
  plantillaDonaciones,
  plantillaSeguimientos,
  plantillaSolicitudes,
} from './listados';

const BASE = { generadoEn: new Date('2026-10-29T15:00:00Z'), logoSvg: '<svg/>' };
const texto = (d: unknown): string => JSON.stringify(d);

describe('pesos', () => {
  it.each([
    ['0.00', '$ 0,00'],
    ['1500.5', '$ 1.500,50'],
    ['1234567.89', '$ 1.234.567,89'],
    ['9007199254740993.10', '$ 9.007.199.254.740.993,10'],
    [null, '—'],
  ])('%s → %s', (entrada, esperado) => expect(pesos(entrada)).toBe(esperado));
});

describe('plantillaSolicitudes', () => {
  const fila = {
    fecha: '2026-10-01',
    mascota: 'Peñita',
    adoptante: 'Ángela Muñoz',
    ciudad: 'Montería',
    estado: EstadoSolicitud.Pendiente,
    observacion: null,
  };

  it('lista la fila, los filtros aplicados y solo columnas operativas', () => {
    const t = texto(
      plantillaSolicitudes({
        ...BASE,
        filtros: ['Estado: pendiente', null],
        listado: {
          filas: [{ ...fila, documento: '123', direccion: 'x', nacimiento: '1990' } as never],
          total: 1,
        },
      }),
    );
    for (const e of [
      'Ángela Muñoz',
      'Montería',
      'Pendiente',
      'Peñita',
      'Filtros: Estado: pendiente',
      '—',
    ]) {
      expect(t).toContain(e);
    }
    expect(t).not.toMatch(/"123"|1990|"x"/);
  });

  it('sin filas indica «Sin resultados» y no dibuja la tabla', () => {
    const t = texto(
      plantillaSolicitudes({ ...BASE, filtros: [], listado: { filas: [], total: 0 } }),
    );
    expect(t).toContain('Sin resultados');
    expect(t).not.toContain('Adoptante');
  });

  it('con más filas que el tope avisa del total', () => {
    const filas = Array.from({ length: 1000 }, () => fila);
    const t = texto(
      plantillaSolicitudes({ ...BASE, filtros: [], listado: { filas, total: 1500 } }),
    );
    expect(t).toContain('primeras 1000 de 1500');
  });
});

describe('plantillaSeguimientos', () => {
  it('traduce estado, tipo y bienestar', () => {
    const t = texto(
      plantillaSeguimientos({
        ...BASE,
        filtros: [],
        listado: {
          filas: [
            {
              fecha: '2026-10-01',
              mascota: 'Rex',
              tipo: 'visita',
              estado: EstadoSeguimiento.Vencido,
              bienestar: EstadoBienestar.Malo,
              observaciones: 'Más control',
            },
            {
              fecha: '2026-10-02',
              mascota: 'Luna',
              tipo: 'reporte',
              estado: EstadoSeguimiento.Programado,
              bienestar: null,
              observaciones: null,
            },
          ],
          total: 2,
        },
      }),
    );
    for (const e of ['Visita', 'Vencido', 'Malo', 'Más control', 'Reporte', 'Programado']) {
      expect(t).toContain(e);
    }
  });
});

describe('plantillaDonaciones', () => {
  it('muestra monto exacto, descripción en especie y totales de TODO el conjunto', () => {
    const t = texto(
      plantillaDonaciones({
        ...BASE,
        filtros: ['Tipo: economica'],
        listado: {
          filas: [
            {
              fecha: '2026-10-01',
              donante: 'Niño Pérez',
              tipo: TipoDonacion.Economica,
              monto: '9007199254740993.10',
              descripcion: null,
            },
            {
              fecha: '2026-10-02',
              donante: 'Ana',
              tipo: TipoDonacion.Especie,
              monto: null,
              descripcion: 'Dos bultos de croquetas',
            },
          ],
          total: 2,
        },
        totales: [
          { tipo: TipoDonacion.Economica, cantidad: 1, monto: '9007199254740993.10' },
          { tipo: TipoDonacion.Especie, cantidad: 1, monto: '0.00' },
        ],
      }),
    );
    for (const e of [
      '$ 9.007.199.254.740.993,10',
      'Dos bultos de croquetas',
      'Niño Pérez',
      'Económicas: 1',
      'En especie: 1',
    ]) {
      expect(t).toContain(e);
    }
  });

  it('sin donaciones: «Sin resultados» y totales en cero', () => {
    const t = texto(
      plantillaDonaciones({ ...BASE, filtros: [], listado: { filas: [], total: 0 }, totales: [] }),
    );
    expect(t).toContain('Sin resultados');
    expect(t).toContain('Económicas: 0 · $ 0,00');
  });
});
