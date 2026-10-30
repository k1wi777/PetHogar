'use client';

import { useQuery } from '@tanstack/react-query';
import { useSesion } from '@/shared/auth/SesionProvider';
import { contarNoLeidas } from '../api/contar';

export const INTERVALO_NO_LEIDAS_MS = 60_000;

/** Contador de notificaciones sin leer: solo con sesión, cada minuto y sin reintentos en cascada. */
export function useNoLeidas() {
  const { estado } = useSesion();
  return useQuery({
    queryKey: ['notificaciones', 'no-leidas'],
    queryFn: () => contarNoLeidas(),
    enabled: estado === 'autenticado',
    refetchInterval: INTERVALO_NO_LEIDAS_MS,
    retry: false,
    select: (datos) => datos.noLeidas,
  });
}
