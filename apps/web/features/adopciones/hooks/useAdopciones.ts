'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSesion } from '@/shared/auth/SesionProvider';
import { enviarReporte, listarMisAdopciones, obtenerMiSeguimiento } from '../api/adopciones';
import type { DetalleSeguimiento } from '../types';

export const claves = {
  lista: (pagina: number) => ['adopciones', 'lista', { pagina }] as const,
  todasLasListas: ['adopciones', 'lista'] as const,
  seguimiento: (id: number) => ['seguimientos', 'detalle', id] as const,
};

const useActiva = () => useSesion().estado === 'autenticado';

export function useMisAdopciones(pagina: number) {
  const activa = useActiva();
  return useQuery({
    queryKey: claves.lista(pagina),
    queryFn: () => listarMisAdopciones(pagina),
    enabled: activa,
    placeholderData: keepPreviousData,
  });
}

export function useSeguimiento(id: number | null) {
  const activa = useActiva();
  return useQuery({
    queryKey: claves.seguimiento(id ?? 0),
    queryFn: () => obtenerMiSeguimiento(id as number),
    enabled: activa && id !== null,
  });
}

/** El bloqueo del formulario se deriva del dato del servidor (`reporte`), no de un indicador local. */
export function useEnviarReporte(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: { comentarios: string; fotos: File[] }) => enviarReporte(id, datos),
    onSuccess: (detalle: DetalleSeguimiento) => {
      queryClient.setQueryData(claves.seguimiento(id), detalle);
      return queryClient.invalidateQueries({ queryKey: claves.todasLasListas });
    },
  });
}
