'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useSesion } from '@/shared/auth/SesionProvider';
import {
  CLAVE_ADOPCIONES_GESTION,
  CLAVE_MASCOTAS_GESTION,
  CLAVE_SOLICITUDES_GESTION,
} from '@/shared/lib/claves-consulta';
import {
  decidirSolicitud,
  listarMascotasParaFiltro,
  listarSolicitudesRecibidas,
  obtenerSolicitudRecibida,
} from '../api/solicitudes';
import type { ConsultaSolicitudes, DatosDecision, DetalleSolicitudRecibida } from '../types';

/** Claves con el prefijo compartido de la feature. */
export const claves = {
  lista: (c: ConsultaSolicitudes) => [CLAVE_SOLICITUDES_GESTION, 'lista', c] as const,
  detalle: (id: number) => [CLAVE_SOLICITUDES_GESTION, 'detalle', id] as const,
  mascotas: [CLAVE_SOLICITUDES_GESTION, 'mascotas'] as const,
  otrasPendientes: (mascotaId: number) =>
    [CLAVE_SOLICITUDES_GESTION, 'otras-pendientes', mascotaId] as const,
};

/** Solo con sesión y fundación aprobada: con otro estado el backend respondería 403. */
function useActiva(): boolean {
  const { estado, usuario } = useSesion();
  return estado === 'autenticado' && usuario?.fundacion?.estadoValidacion === 'aprobada';
}

export function useSolicitudesRecibidas(consulta: ConsultaSolicitudes) {
  const activa = useActiva();
  return useQuery({
    queryKey: claves.lista(consulta),
    queryFn: () => listarSolicitudesRecibidas(consulta),
    enabled: activa,
    placeholderData: keepPreviousData,
  });
}

export function useSolicitudRecibida(id: number | null) {
  const activa = useActiva();
  return useQuery({
    queryKey: claves.detalle(id ?? 0),
    queryFn: () => obtenerSolicitudRecibida(id as number),
    enabled: activa && id !== null,
  });
}

export function useMascotasParaFiltro() {
  const activa = useActiva();
  return useQuery({
    queryKey: claves.mascotas,
    queryFn: () => listarMascotasParaFiltro(),
    enabled: activa,
    staleTime: 60_000,
  });
}

/**
 * Cuántas otras solicitudes pendientes tiene la mascota (informativo: la advertencia del diálogo
 * no depende de esta consulta). `total - 1` descuenta la que se está decidiendo.
 */
export function useOtrasPendientes(mascotaId: number, habilitada: boolean) {
  const activa = useActiva();
  return useQuery({
    queryKey: claves.otrasPendientes(mascotaId),
    queryFn: async () => {
      const pagina = await listarSolicitudesRecibidas(
        { pagina: 1, estado: 'pendiente', mascotaId },
        1,
      );
      return Math.max(0, pagina.total - 1);
    },
    enabled: activa && habilitada,
    staleTime: 0,
  });
}

/**
 * Decisión pesimista (la decisión es irreversible): se escribe la respuesta del servidor y se
 * invalidan los prefijos compartidos, porque aprobar crea una adopción, deja la mascota como
 * adoptada y rechaza las demás solicitudes pendientes de esa mascota.
 */
export function useDecidirSolicitud(id: number) {
  const queryClient = useQueryClient();
  const refrescar = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [CLAVE_SOLICITUDES_GESTION] }),
      queryClient.invalidateQueries({ queryKey: [CLAVE_ADOPCIONES_GESTION] }),
      queryClient.invalidateQueries({ queryKey: [CLAVE_MASCOTAS_GESTION] }),
    ]);
  const mutacion = useMutation({
    mutationFn: (datos: DatosDecision) => decidirSolicitud(id, datos),
    onSuccess: (detalle) => {
      queryClient.setQueryData(claves.detalle(id), detalle);
      void refrescar();
    },
    // 409/404: el estado real cambió en el servidor, se vuelve a leer.
    onError: () => void queryClient.invalidateQueries({ queryKey: claves.detalle(id) }),
  });
  const enCurso = useRef(false);
  /**
   * Devuelve una promesa (los callbacks de `mutate` no se ejecutan si la pantalla se desmonta, y el
   * panel de decisión desaparece al refrescar el detalle). Ignora un segundo envío en curso.
   */
  const decidir = async (datos: DatosDecision): Promise<DetalleSolicitudRecibida | undefined> => {
    if (enCurso.current) return undefined;
    enCurso.current = true;
    try {
      return await mutacion.mutateAsync(datos);
    } finally {
      enCurso.current = false;
    }
  };
  return { decidir, isPending: mutacion.isPending };
}
