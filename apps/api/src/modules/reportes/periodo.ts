import { BadRequestException } from '@nestjs/common';
import { inicioDelDiaEnBogota } from '../../common/validation/fecha';
import { MENSAJE_PERIODO_INVERTIDO } from './reportes.constants';
import type { FiltroReporte } from './reportes.types';

const UN_DIA_MS = 86_400_000;

/**
 * Convierte `desde`/`hasta` (días de Bogotá, ambos incluidos) en el filtro de las consultas:
 * fechas de día para columnas `date` e intervalo semiabierto de instantes para `timestamptz`.
 */
export function filtroDePeriodo(
  fundacionId: number | undefined,
  desde?: string,
  hasta?: string,
): FiltroReporte {
  if (desde && hasta && hasta < desde) throw new BadRequestException(MENSAJE_PERIODO_INVERTIDO);
  return {
    fundacionId,
    desde,
    hasta,
    desdeInstante: desde ? inicioDelDiaEnBogota(desde) : undefined,
    hastaExclusivo: hasta ? new Date(inicioDelDiaEnBogota(hasta).getTime() + UN_DIA_MS) : undefined,
  };
}
