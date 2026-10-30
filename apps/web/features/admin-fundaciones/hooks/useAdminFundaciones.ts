'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useSesion } from '@/shared/auth/SesionProvider';
import { CLAVE_ADMIN_FUNDACIONES } from '@/shared/lib/claves-consulta';
import { decidirValidacion, listarFundaciones, obtenerFundacion } from '../api/fundaciones';
import type { ConsultaFundaciones, DatosValidacion, DetalleFundacion } from '../types';

export const claves = {
  todas: [CLAVE_ADMIN_FUNDACIONES] as const,
  lista: (c: ConsultaFundaciones) => [CLAVE_ADMIN_FUNDACIONES, 'lista', c] as const,
  detalle: (id: number) => [CLAVE_ADMIN_FUNDACIONES, 'detalle', id] as const,
};

/** El rol ya lo impone `GuardaRol` del layout: aquí solo se espera a tener sesión. */
function useConSesion(): boolean {
  return useSesion().estado === 'autenticado';
}

export function useFundaciones(consulta: ConsultaFundaciones) {
  const activa = useConSesion();
  return useQuery({
    queryKey: claves.lista(consulta),
    queryFn: () => listarFundaciones(consulta),
    enabled: activa,
    placeholderData: keepPreviousData,
  });
}

export function useFundacion(id: number | null) {
  const activa = useConSesion();
  return useQuery({
    queryKey: claves.detalle(id ?? 0),
    queryFn: () => obtenerFundacion(id as number),
    enabled: activa && id !== null,
  });
}

/**
 * Decisión pesimista (dispara un correo y avisa a la fundación): solo cuando el servidor confirma
 * se escribe el detalle y se invalida el prefijo entero (todas las listas por estado y el detalle).
 * Devuelve una promesa porque el panel desaparece al cambiar el estado y los callbacks de `mutate`
 * no se ejecutarían; ignora un segundo envío en curso.
 */
export function useDecidirValidacion(id: number) {
  const queryClient = useQueryClient();
  const mutacion = useMutation({
    mutationFn: (datos: DatosValidacion) => decidirValidacion(id, datos),
    onSuccess: (detalle) => {
      queryClient.setQueryData(claves.detalle(id), detalle);
      void queryClient.invalidateQueries({ queryKey: claves.todas });
    },
    // 409/404: el estado real cambió en el servidor, se vuelve a leer.
    onError: () => void queryClient.invalidateQueries({ queryKey: claves.detalle(id) }),
  });
  const enCurso = useRef(false);
  const decidir = async (datos: DatosValidacion): Promise<DetalleFundacion | undefined> => {
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
