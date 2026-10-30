import type { DecisionValidacion, EstadoValidacion } from '../types';

/**
 * Única fuente en el front de qué decisiones permite cada estado: espejo de `TRANSICIONES` del
 * backend (`pendiente → aprobada | rechazada`, `rechazada → aprobada`; `aprobada` es terminal).
 */
const DECISIONES_POSIBLES: Readonly<Record<EstadoValidacion, readonly DecisionValidacion[]>> = {
  pendiente: ['aprobada', 'rechazada'],
  rechazada: ['aprobada'],
  aprobada: [],
};

export function decisionesPosibles(estado: EstadoValidacion): readonly DecisionValidacion[] {
  return DECISIONES_POSIBLES[estado];
}
