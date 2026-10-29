import { EstadoMascotaMaquina, type OrigenCambio } from './estado-mascota.maquina';
import { EstadoMascota } from './entities/mascota.enum';

const ESTADOS = Object.values(EstadoMascota);
const ORIGENES: OrigenCambio[] = ['fundacion', 'adopcion', 'revocacion'];

const PERMITIDAS: [EstadoMascota, EstadoMascota, OrigenCambio][] = [
  [EstadoMascota.Disponible, EstadoMascota.EnProceso, 'adopcion'],
  [EstadoMascota.Disponible, EstadoMascota.Adoptada, 'adopcion'],
  [EstadoMascota.EnProceso, EstadoMascota.Adoptada, 'adopcion'],
  [EstadoMascota.Disponible, EstadoMascota.Inactiva, 'fundacion'],
  [EstadoMascota.Adoptada, EstadoMascota.Disponible, 'revocacion'],
  [EstadoMascota.Adoptada, EstadoMascota.Inactiva, 'revocacion'],
];

describe('EstadoMascotaMaquina', () => {
  it('solo permite las seis transiciones definidas, cada una con su origen', () => {
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

  it('inactiva es terminal y adoptada solo se abandona por revocación', () => {
    for (const hasta of ESTADOS) {
      for (const origen of ORIGENES) {
        expect(EstadoMascotaMaquina.puede(EstadoMascota.Inactiva, hasta, origen)).toBe(false);
        if (origen !== 'revocacion') {
          expect(EstadoMascotaMaquina.puede(EstadoMascota.Adoptada, hasta, origen)).toBe(false);
        }
      }
    }
  });

  it('la revocación no obtiene ninguna transición hacia adoptada ni en_proceso ni desde otros estados', () => {
    for (const desde of ESTADOS.filter((e) => e !== EstadoMascota.Adoptada)) {
      for (const hasta of ESTADOS) {
        expect(EstadoMascotaMaquina.puede(desde, hasta, 'revocacion')).toBe(false);
      }
    }
    expect(
      EstadoMascotaMaquina.puede(EstadoMascota.Adoptada, EstadoMascota.EnProceso, 'revocacion'),
    ).toBe(false);
  });

  it('la fundación no obtiene la transición disponible → adoptada', () => {
    expect(
      EstadoMascotaMaquina.puede(EstadoMascota.Disponible, EstadoMascota.Adoptada, 'fundacion'),
    ).toBe(false);
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
    expect(EstadoMascotaMaquina.origenesPara(EstadoMascota.Adoptada, 'adopcion')).toEqual([
      EstadoMascota.Disponible,
      EstadoMascota.EnProceso,
    ]);
    expect(EstadoMascotaMaquina.origenesPara(EstadoMascota.Adoptada, 'fundacion')).toEqual([]);
    expect(EstadoMascotaMaquina.origenesPara(EstadoMascota.Disponible, 'fundacion')).toEqual([]);
    expect(EstadoMascotaMaquina.origenesPara(EstadoMascota.Disponible, 'revocacion')).toEqual([
      EstadoMascota.Adoptada,
    ]);
    expect(EstadoMascotaMaquina.origenesPara(EstadoMascota.Inactiva, 'revocacion')).toEqual([
      EstadoMascota.Adoptada,
    ]);
    expect(EstadoMascotaMaquina.origenesPara(EstadoMascota.Adoptada, 'revocacion')).toEqual([]);
  });

  it('solo disponible y en_proceso son editables', () => {
    expect(ESTADOS.filter((e) => EstadoMascotaMaquina.editable(e))).toEqual([
      EstadoMascota.Disponible,
      EstadoMascota.EnProceso,
    ]);
  });
});
