import type { ClienteHttp } from '@/shared/api/cliente';
import { http } from '@/shared/api/http';
import type { Ambito, ConsultaEstadisticas, EstadisticasDto } from '../types';

/**
 * `fundacion` consulta la propia (`/fundacion/estadisticas`); `administrador` consulta toda la
 * plataforma o una fundación con `fundacionId` (solo ese ámbito lo envía).
 */
export function obtenerEstadisticas(
  ambito: Ambito,
  consulta: ConsultaEstadisticas,
  cliente: ClienteHttp = http,
): Promise<EstadisticasDto> {
  if (ambito === 'fundacion') {
    return cliente.get<EstadisticasDto>('/fundacion/estadisticas', {
      consulta: { desde: consulta.desde, hasta: consulta.hasta },
    });
  }
  return cliente.get<EstadisticasDto>('/admin/estadisticas', {
    consulta: { fundacionId: consulta.fundacionId, desde: consulta.desde, hasta: consulta.hasta },
  });
}
