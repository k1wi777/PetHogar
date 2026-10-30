'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { useRef } from 'react';
import { useSesion } from '@/shared/auth/SesionProvider';
import { CLAVE_ADMIN_USUARIOS } from '@/shared/lib/claves-consulta';
import { cambiarEstadoUsuario, listarUsuarios } from '../api/usuarios';
import type { ConsultaUsuarios, PaginaUsuarios, UsuarioAdmin } from '../types';

export const claves = {
  todas: [CLAVE_ADMIN_USUARIOS] as const,
  lista: (c: ConsultaUsuarios) => [CLAVE_ADMIN_USUARIOS, 'lista', c] as const,
};

export function useUsuarios(consulta: ConsultaUsuarios) {
  const { estado } = useSesion();
  return useQuery({
    queryKey: claves.lista(consulta),
    queryFn: () => listarUsuarios(consulta),
    enabled: estado === 'autenticado',
    placeholderData: keepPreviousData,
  });
}

/**
 * Pesimista: el servidor puede rechazar (propia cuenta, último administrador activo), así que la
 * fila solo cambia cuando responde. Entonces se reemplaza en todas las páginas en caché (efecto
 * inmediato) y se invalida el prefijo para recontar. Ignora un segundo envío en curso.
 */
export function useCambiarEstadoUsuario() {
  const queryClient = useQueryClient();
  const mutacion = useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: boolean }) =>
      cambiarEstadoUsuario(id, activo),
    onSuccess: (usuario) => {
      queryClient.setQueriesData<PaginaUsuarios>(
        { queryKey: claves.todas as unknown as QueryKey },
        (pagina) =>
          pagina && {
            ...pagina,
            data: pagina.data.map((u) => (u.id === usuario.id ? { ...u, ...usuario } : u)),
          },
      );
      void queryClient.invalidateQueries({ queryKey: claves.todas });
    },
  });
  const enCurso = useRef(false);
  const cambiar = async (id: number, activo: boolean): Promise<UsuarioAdmin | undefined> => {
    if (enCurso.current) return undefined;
    enCurso.current = true;
    try {
      return await mutacion.mutateAsync({ id, activo });
    } finally {
      enCurso.current = false;
    }
  };
  return { cambiar, isPending: mutacion.isPending };
}
