'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSesion } from '@/shared/auth/SesionProvider';
import { CLAVE_ADOPCIONES_GESTION } from '@/shared/lib/claves-consulta';
import {
  listarAdopciones,
  obtenerSeguimiento,
  programarSeguimiento,
  registrarResultado,
} from '../api/adopciones';
import type {
  ConsultaAdopciones,
  DatosProgramar,
  DatosResultado,
  DetalleSeguimientoFundacion,
} from '../types';

/**
 * Claves con el prefijo compartido: la lista y el detalle del seguimiento lo comparten, así que
 * una sola invalidación mantiene coherente la línea de tiempo de la adopción.
 */
export const claves = {
  todas: [CLAVE_ADOPCIONES_GESTION] as const,
  lista: (c: ConsultaAdopciones) => [CLAVE_ADOPCIONES_GESTION, 'lista', c] as const,
  seguimiento: (id: number) => [CLAVE_ADOPCIONES_GESTION, 'seguimiento', id] as const,
};

/** Solo con sesión y fundación aprobada: con otro estado el backend respondería 403. */
function useActiva(): boolean {
  const { estado, usuario } = useSesion();
  return estado === 'autenticado' && usuario?.fundacion?.estadoValidacion === 'aprobada';
}

export function useAdopciones(consulta: ConsultaAdopciones) {
  const activa = useActiva();
  return useQuery({
    queryKey: claves.lista(consulta),
    queryFn: () => listarAdopciones(consulta),
    enabled: activa,
    placeholderData: keepPreviousData,
  });
}

export function useSeguimientoFundacion(id: number | null) {
  const activa = useActiva();
  return useQuery({
    queryKey: claves.seguimiento(id ?? 0),
    queryFn: () => obtenerSeguimiento(id as number),
    enabled: activa && id !== null,
  });
}

/** La lista es paginada y no admite escritura parcial: se invalida y se vuelve a leer. */
export function useProgramarSeguimiento(adopcionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: DatosProgramar) => programarSeguimiento(adopcionId, datos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: claves.todas }),
    // 409 (duplicado o adopción cerrada): el estado real puede haber cambiado.
    onError: () => void queryClient.invalidateQueries({ queryKey: claves.todas }),
  });
}

export function useRegistrarResultado(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: DatosResultado) => registrarResultado(id, datos),
    onSuccess: (detalle: DetalleSeguimientoFundacion) => {
      queryClient.setQueryData(claves.seguimiento(id), detalle);
      return queryClient.invalidateQueries({ queryKey: [...claves.todas, 'lista'] });
    },
    // 409: otro usuario lo registró o el reporte aún no existe; se vuelve a leer.
    onError: () => void queryClient.invalidateQueries({ queryKey: claves.seguimiento(id) }),
  });
}
