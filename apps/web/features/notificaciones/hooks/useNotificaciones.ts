'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { esErrorApi } from '@/shared/api/errores';
import { useSesion } from '@/shared/auth/SesionProvider';
import { aviso } from '@/shared/ui/Toaster';
import {
  NOTIFICACIONES_RECIENTES,
  leerTodas,
  listarNotificaciones,
  marcarLeida,
} from '../api/notificaciones';
import type { ConsultaNotificaciones } from '../types';
import { claves } from './claves';

function useAutenticado(): boolean {
  return useSesion().estado === 'autenticado';
}

/** Lista completa paginada; conserva la página anterior mientras llega la siguiente. */
export function useListaNotificaciones(consulta: ConsultaNotificaciones) {
  const autenticado = useAutenticado();
  return useQuery({
    queryKey: claves.lista(consulta),
    queryFn: () => listarNotificaciones(consulta),
    enabled: autenticado,
    placeholderData: keepPreviousData,
  });
}

/** Las más recientes del menú: se piden al abrirlo (siempre obsoletas, sin sondeo). */
export function useNotificacionesRecientes(abierto: boolean) {
  const autenticado = useAutenticado();
  return useQuery({
    queryKey: claves.recientes,
    queryFn: () => listarNotificaciones({ pagina: 1, filtro: 'todas' }, NOTIFICACIONES_RECIENTES),
    enabled: autenticado && abierto,
    staleTime: 0,
  });
}

/** Ajusta el contador de inmediato y devuelve cómo deshacerlo si la petición falla. */
async function ajustarContador(
  queryClient: QueryClient,
  nuevo: (actual: number) => number,
): Promise<() => void> {
  await queryClient.cancelQueries({ queryKey: claves.noLeidas });
  const previo = queryClient.getQueryData<{ noLeidas: number }>(claves.noLeidas);
  if (previo) queryClient.setQueryData(claves.noLeidas, { noLeidas: nuevo(previo.noLeidas) });
  return () => {
    if (previo) queryClient.setQueryData(claves.noLeidas, previo);
  };
}

interface ContextoMutacion {
  deshacer: () => void;
}

/**
 * Marca una notificación como leída: el contador baja de inmediato (solo si estaba sin leer) y
 * se deshace si falla. Un 404 (ajena o ya borrada) cuenta como éxito silencioso. Al terminar
 * se vuelve a pedir todo lo del servidor: la lista paginada no se edita a mano.
 */
export function useMarcarLeida() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, { id: number; leida: boolean }, ContextoMutacion>({
    mutationFn: async ({ id }) => {
      try {
        return await marcarLeida(id);
      } catch (error) {
        if (esErrorApi(error) && error.estado === 404) return null;
        throw error;
      }
    },
    onMutate: async ({ leida }) => ({
      deshacer: leida
        ? () => undefined
        : await ajustarContador(queryClient, (n) => Math.max(0, n - 1)),
    }),
    // El aviso vive aquí y no en `mutate(…, { onError })`: el menú se desmonta al abrir una
    // notificación y esos callbacks se perderían.
    onError: (_error, _vars, contexto) => {
      contexto?.deshacer();
      aviso.error('No pudimos marcar la notificación como leída.');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: claves.todas }),
  });
}

/** «Marcar todas como leídas»: contador a 0 de inmediato y se deshace si falla. */
export function useLeerTodas() {
  const queryClient = useQueryClient();
  return useMutation<{ actualizadas: number }, Error, void, ContextoMutacion>({
    mutationFn: () => leerTodas(),
    onMutate: async () => ({ deshacer: await ajustarContador(queryClient, () => 0) }),
    onError: (_error, _vars, contexto) => contexto?.deshacer(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: claves.todas }),
  });
}
