import { aEstadisticas, completarCuentas, type DatosEstadisticas } from './reportes.mapeo';

const VACIO: DatosEstadisticas = {
  filtros: { fundacionId: 1, desde: null, hasta: null },
  adopcionesPorMes: [],
  adopcionesPorEspecie: [],
  solicitudes: [],
  seguimientos: [],
  bienestar: [],
  donacionesPorMes: [],
  donacionesPorTipo: [],
};

describe('completarCuentas', () => {
  it('rellena con 0 las categorías ausentes e ignora claves desconocidas', () => {
    expect(
      completarCuentas(
        ['a', 'b', 'c'],
        [
          { clave: 'b', cantidad: 3 },
          { clave: 'zzz', cantidad: 9 },
        ],
      ),
    ).toEqual({ a: 0, b: 3, c: 0 });
  });
});

describe('aEstadisticas', () => {
  it('sin datos devuelve todas las categorías en 0 y montos en 0.00', () => {
    const e = aEstadisticas(VACIO);
    expect(e.adopciones).toEqual({ total: 0, porMes: [], porEspecie: [] });
    expect(e.solicitudes).toEqual({
      total: 0,
      porEstado: { pendiente: 0, aprobada: 0, rechazada: 0, cancelada: 0 },
    });
    expect(e.seguimientos.porEstado).toEqual({
      programado: 0,
      realizado: 0,
      vencido: 0,
      cancelado: 0,
    });
    expect(e.seguimientos.porBienestar).toEqual({ bueno: 0, regular: 0, malo: 0 });
    expect(e.donaciones.porTipo).toEqual({
      economica: { cantidad: 0, monto: '0.00' },
      especie: { cantidad: 0 },
    });
    expect(e.donaciones.total).toBe(0);
  });

  it('los totales son la suma de las categorías y conservan el monto exacto como cadena', () => {
    const e = aEstadisticas({
      ...VACIO,
      adopcionesPorMes: [
        { mes: '2026-09', cantidad: 2 },
        { mes: '2026-10', cantidad: 3 },
      ],
      solicitudes: [
        { estado: 'pendiente', cantidad: 4 },
        { estado: 'aprobada', cantidad: 5 },
      ],
      seguimientos: [{ estado: 'vencido', cantidad: 2 }],
      bienestar: [{ bienestar: 'malo', cantidad: 1 }],
      donacionesPorMes: [{ mes: '2026-10', cantidad: 3, monto: '9007199254740993.10' }],
      donacionesPorTipo: [
        { tipo: 'economica', cantidad: 2, monto: '9007199254740993.10' },
        { tipo: 'especie', cantidad: 1, monto: '0.00' },
      ],
    } as DatosEstadisticas);
    expect(e.adopciones.total).toBe(5);
    expect(e.solicitudes.total).toBe(9);
    expect(e.seguimientos).toMatchObject({ total: 2, porBienestar: { malo: 1, bueno: 0 } });
    expect(e.donaciones.total).toBe(3);
    expect(e.donaciones.porTipo.economica.monto).toBe('9007199254740993.10');
  });
});
