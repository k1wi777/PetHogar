'use client';

import { useQuery } from '@tanstack/react-query';
import { useSesion } from '@/shared/auth/SesionProvider';
import { listarFundacionesPorValidar, obtenerExtractoEstadisticas } from '../api/administrador';
import { contarNoLeidasResumen } from '../api/notificaciones';
import { claves } from './claves';

export function useResumenAdministrador() {
  const { estado } = useSesion();
  const enabled = estado === 'autenticado';

  const fundaciones = useQuery({
    queryKey: claves.administrador.fundaciones,
    enabled,
    queryFn: () => listarFundacionesPorValidar(),
  });
  const estadisticas = useQuery({
    queryKey: claves.administrador.estadisticas,
    enabled,
    queryFn: () => obtenerExtractoEstadisticas(),
  });
  const notificaciones = useQuery({
    queryKey: claves.noLeidas,
    enabled,
    queryFn: () => contarNoLeidasResumen(),
    select: (d) => d.noLeidas,
  });

  return { fundaciones, estadisticas, notificaciones };
}
