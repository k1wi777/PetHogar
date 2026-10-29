import { EstadoMascotaMaquina, type OrigenCambio } from './estado-mascota.maquina';
import { EstadoMascota } from './entities/mascota.enum';

const ESTADOS = Object.values(EstadoMascota);
const ORIGENES: OrigenCambio[] = ['fundacion', 'adopcion'];

const PERMITIDAS: [EstadoMascota, EstadoMascota, OrigenCambio][] = [
  [EstadoMascota.Disponible, EstadoMascota.EnProceso, 'adopcion'],
  [EstadoMascota.EnProceso, EstadoMascota.Adoptada, 'adopcion'],
  [EstadoMascota.Disponible, EstadoMascota.Inactiva, 'fundacion'],
];

describe('EstadoMascotaMaquina', () => {
  it('solo permite las tres transiciones del plan, cada una con su origen', () => {
    for (const desde of ESTADOS) {
      for (const hasta of ESTADOS) {
        for (const origen of ORIGENES) {
          const esperado = PERMITIDAS.some(
            ([d, h, o]) => d === desde && h === hasta && o === origen,
          );
          expect(EstadoMascotaMaquina.puede(desde, hasta, origen)).toBe(esperado);
        }
      }
    }
  });

  it('adoptada e inactiva son terminales', () => {
    for (const terminal of [EstadoMascota.Adoptada, EstadoMascota.Inactiva]) {
      for (const hasta of ESTADOS) {
        for (const origen of ORIGENES) {
          expect(EstadoMascotaMaquina.puede(terminal, hasta, origen)).toBe(false);
        }
      }
    }
  });

  it('la fundación no puede llevar una mascota adoptada a disponible', () => {
    expect(
      EstadoMascotaMaquina.puede(EstadoMascota.Adoptada, EstadoMascota.Disponible, 'fundacion'),
    ).toBe(false);
  });

  it('origenesPara devuelve los estados de partida válidos', () => {
    expect(EstadoMascotaMaquina.origenesPara(EstadoMascota.Inactiva, 'fundacion')).toEqual([
      EstadoMascota.Disponible,
    ]);
    expect(EstadoMascotaMaquina.origenesPara(EstadoMascota.Inactiva, 'adopcion')).toEqual([]);
    expect(EstadoMascotaMaquina.origenesPara(EstadoMascota.Disponible, 'fundacion')).toEqual([]);
  });

  it('solo disponible y en_proceso son editables', () => {
    expect(ESTADOS.filter((e) => EstadoMascotaMaquina.editable(e))).toEqual([
      EstadoMascota.Disponible,
      EstadoMascota.EnProceso,
    ]);
  });
});
