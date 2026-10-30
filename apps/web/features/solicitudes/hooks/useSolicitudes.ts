'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSesion } from '@/shared/auth/SesionProvider';
import { obtenerMascotaParaSolicitar } from '../api/mascota';
import {
  cancelarSolicitud,
  crearSolicitud,
  listarMisSolicitudes,
  obtenerMiSolicitud,
  type DatosEnvio,
} from '../api/solicitudes';
import type { ConsultaSolicitudes, DetalleSolicitud } from '../types';

/** Claves con prefijo propio: esta feature no invalida claves de otras. */
export const claves = {
  lista: (c: ConsultaSolicitudes) => ['solicitudes', 'lista', c] as const,
  todasLasListas: ['solicitudes', 'lista'] as const,
  detalle: (id: number) => ['solicitudes', 'detalle', id] as const,
  mascota: (id: number) => ['solicitudes', 'mascota', id] as const,
};

function useActiva(): boolean {
  return useSesion().estado === 'autenticado';
}

export function useMascotaParaSolicitar(id: number | null) {
  const activa = useActiva();
  return useQuery({
    queryKey: claves.mascota(id ?? 0),
    queryFn: () => obtenerMascotaParaSolicitar(id as number),
    enabled: activa && id !== null,
  });
}

export function useMisSolicitudes(consulta: ConsultaSolicitudes) {
  const activa = useActiva();
  return useQuery({
    queryKey: claves.lista(consulta),
    queryFn: () => listarMisSolicitudes(consulta),
    enabled: activa,
    placeholderData: keepPreviousData,
  });
}

export function useSolicitud(id: number | null) {
  const activa = useActiva();
  return useQuery({
    queryKey: claves.detalle(id ?? 0),
    queryFn: () => obtenerMiSolicitud(id as number),
    enabled: activa && id !== null,
  });
}

export function useCrearSolicitud() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: DatosEnvio) => crearSolicitud(datos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: claves.todasLasListas }),
  });
}

/**
 * Cancelación pesimista: el estado lo decide también la fundación, así que no se muestra
 * «Cancelada» antes de saberlo. Con éxito se escribe la respuesta; con 409 se recarga lo vigente.
 */
export function useCancelarSolicitud(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cancelarSolicitud(id),
    onSuccess: (detalle: DetalleSolicitud) => {
      queryClient.setQueryData(claves.detalle(id), detalle);
      return queryClient.invalidateQueries({ queryKey: claves.todasLasListas });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: claves.detalle(id) });
      void queryClient.invalidateQueries({ queryKey: claves.todasLasListas });
    },
  });
}
