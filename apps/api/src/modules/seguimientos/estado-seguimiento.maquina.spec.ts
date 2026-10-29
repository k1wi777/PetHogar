import { EstadoSeguimientoMaquina, type ActorSeguimiento } from './estado-seguimiento.maquina';
import { EstadoSeguimiento as E } from './entities/seguimiento.enum';

const ESTADOS = Object.values(E);
const ACTORES: ActorSeguimiento[] = ['tarea', 'resultado', 'cierre'];

const PERMITIDAS: [E, E, ActorSeguimiento][] = [
  [E.Programado, E.Vencido, 'tarea'],
  [E.Programado, E.Realizado, 'resultado'],
  [E.Vencido, E.Realizado, 'resultado'],
  [E.Programado, E.Cancelado, 'cierre'],
  [E.Vencido, E.Cancelado, 'cierre'],
];

describe('EstadoSeguimientoMaquina', () => {
  it('solo permite las cinco transiciones definidas, cada una con su actor', () => {
    for (const desde of ESTADOS) {
      for (const hasta of ESTADOS) {
        for (const actor of ACTORES) {
          const esperado = PERMITIDAS.some(
            ([d, h, a]) => d === desde && h === hasta && a === actor,
          );
          expect([
            desde,
            hasta,
            actor,
            EstadoSeguimientoMaquina.puede(desde, hasta, actor),
          ]).toEqual([desde, hasta, actor, esperado]);
        }
      }
    }
  });

  it('realizado y cancelado son terminales', () => {
    for (const terminal of [E.Realizado, E.Cancelado]) {
      for (const hasta of ESTADOS) {
        for (const actor of ACTORES) {
          expect(EstadoSeguimientoMaquina.puede(terminal, hasta, actor)).toBe(false);
        }
      }
    }
  });

  it('vencido no es terminal: se puede cerrar o cancelar', () => {
    expect(EstadoSeguimientoMaquina.puede(E.Vencido, E.Realizado, 'resultado')).toBe(true);
    expect(EstadoSeguimientoMaquina.puede(E.Vencido, E.Cancelado, 'cierre')).toBe(true);
    expect(EstadoSeguimientoMaquina.puede(E.Vencido, E.Vencido, 'tarea')).toBe(false);
  });

  it('origenesPara devuelve los estados de partida de cada UPDATE condicionado', () => {
    expect(EstadoSeguimientoMaquina.origenesPara(E.Vencido, 'tarea')).toEqual([E.Programado]);
    expect(EstadoSeguimientoMaquina.origenesPara(E.Realizado, 'resultado')).toEqual([
      E.Programado,
      E.Vencido,
    ]);
    expect(EstadoSeguimientoMaquina.origenesPara(E.Cancelado, 'cierre')).toEqual([
      E.Programado,
      E.Vencido,
    ]);
    expect(EstadoSeguimientoMaquina.origenesPara(E.Programado, 'tarea')).toEqual([]);
    expect(EstadoSeguimientoMaquina.origenesPara(E.Realizado, 'tarea')).toEqual([]);
  });

  it('pendientes son programado y vencido', () => {
    expect(ESTADOS.filter((e) => EstadoSeguimientoMaquina.esPendiente(e))).toEqual([
      E.Programado,
      E.Vencido,
    ]);
    expect(EstadoSeguimientoMaquina.pendientes()).toEqual([E.Programado, E.Vencido]);
  });
});
