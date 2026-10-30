'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useSesion } from '@/shared/auth/SesionProvider';
import { contarNoLeidas } from '../api/contar';
import { claves } from './claves';

export const INTERVALO_NO_LEIDAS_MS = 30_000;
export const FRESCURA_NO_LEIDAS_MS = 10_000;

/**
 * Contador de notificaciones sin leer. Solo con sesión; cada 30 s mientras la pestaña esté
 * visible (TanStack Query pausa el intervalo con la pestaña oculta y no lanza otra petición si hay
 * una en vuelo); al volver a la pestaña se refresca si pasaron más de 10 s. Sin reintentos
 * en cascada: un fallo conserva el último valor y se reintenta en el siguiente ciclo.
 * Si el contador sube, la lista y los recientes se marcan obsoletos (las abiertas se refrescan).
 */
export function useNoLeidas() {
  const { estado } = useSesion();
  const queryClient = useQueryClient();
  const consulta = useQuery({
    queryKey: claves.noLeidas,
    queryFn: () => contarNoLeidas(),
    enabled: estado === 'autenticado',
    refetchInterval: INTERVALO_NO_LEIDAS_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: FRESCURA_NO_LEIDAS_MS,
    retry: false,
    select: (datos) => datos.noLeidas,
  });

  const anterior = useRef<number | undefined>(undefined);
  const actual = consulta.data;
  useEffect(() => {
    if (actual === undefined) return;
    if (anterior.current !== undefined && actual > anterior.current) {
      void queryClient.invalidateQueries({ queryKey: claves.lista() });
      void queryClient.invalidateQueries({ queryKey: claves.recientes });
    }
    anterior.current = actual;
  }, [actual, queryClient]);

  return consulta;
}

/**
 * Lee el contador ya cacheado sin consultar ni sondear (el único que sondea es el de la campana,
 * para no duplicar peticiones).
 */
export function useNoLeidasEnCache() {
  return useQuery({
    queryKey: claves.noLeidas,
    queryFn: () => contarNoLeidas(),
    enabled: false,
    select: (datos) => datos.noLeidas,
  });
}
