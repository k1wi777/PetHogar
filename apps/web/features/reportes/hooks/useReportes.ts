'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { esErrorApi } from '@/shared/api/errores';
import { useSesion } from '@/shared/auth/SesionProvider';
import { CLAVE_REPORTES } from '@/shared/lib/claves-consulta';
import { listarFundacionesAprobadas } from '../api/fundaciones';
import { obtenerEstadisticas } from '../api/estadisticas';
import type { Ambito, ConsultaEstadisticas } from '../types';

export const claves = {
  estadisticas: (ambito: Ambito, c: ConsultaEstadisticas) =>
    [CLAVE_REPORTES, 'estadisticas', ambito, c] as const,
  fundaciones: [CLAVE_REPORTES, 'fundaciones-aprobadas'] as const,
};

/** Un 4xx es una respuesta definitiva (rango, fundación inexistente, 403, 429): no se repite sola. */
const sinReintentoEn4xx = (intentos: number, error: unknown) =>
  intentos < 1 &&
  !(esErrorApi(error) && (error.esRed || error.esSesionVencida || error.estado >= 400));

/**
 * Con sesión y, en el ámbito fundación, solo aprobada (con otro estado el backend respondería
 * 403). La consulta NO incluye el tipo de reporte: una sola petición alimenta los cuatro paneles.
 * 60 s de frescura: el límite de 60/min no se roza aunque se cambie de pestaña o de filtro.
 */
export function useEstadisticas(ambito: Ambito, consulta: ConsultaEstadisticas) {
  const { estado, usuario } = useSesion();
  const activa =
    estado === 'autenticado' &&
    (ambito === 'administrador' || usuario?.fundacion?.estadoValidacion === 'aprobada');
  return useQuery({
    queryKey: claves.estadisticas(ambito, consulta),
    queryFn: () => obtenerEstadisticas(ambito, consulta),
    enabled: activa,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: sinReintentoEn4xx,
  });
}

/** Solo el administrador necesita las fundaciones aprobadas para el selector. */
export function useFundacionesAprobadas(habilitada: boolean) {
  const { estado } = useSesion();
  return useQuery({
    queryKey: claves.fundaciones,
    queryFn: () => listarFundacionesAprobadas(),
    enabled: habilitada && estado === 'autenticado',
    staleTime: 5 * 60_000,
  });
}
