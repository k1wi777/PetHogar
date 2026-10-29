import { hoyEnBogota } from '../../../common/validation/fecha';

export { ZONA_HORARIA, esFechaCalendario, hoyEnBogota } from '../../../common/validation/fecha';

/** Un registro del día de hoy en Colombia es válido aunque en UTC ya sea «mañana». */
export function fechaNoFutura(fecha: string, ahora: Date): boolean {
  return fecha <= hoyEnBogota(ahora);
}
