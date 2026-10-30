'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSesion } from '@/shared/auth/SesionProvider';
import { CLAVE_DONACIONES_GESTION } from '@/shared/lib/claves-consulta';
import { listarDonaciones, registrarDonacionManual } from '../api/donaciones';
import type { ConsultaDonaciones, DatosDonacionManual } from '../types';

export const claves = {
  todas: [CLAVE_DONACIONES_GESTION] as const,
  lista: (c: ConsultaDonaciones) => [CLAVE_DONACIONES_GESTION, 'lista', c] as const,
};

/** Solo con sesión y fundación aprobada: con otro estado el backend respondería 403. */
function useActiva(): boolean {
  const { estado, usuario } = useSesion();
  return estado === 'autenticado' && usuario?.fundacion?.estadoValidacion === 'aprobada';
}

/**
 * La página y los totales vienen de la MISMA petición y comparten clave: nunca se muestran
 * totales de un filtro junto a una lista de otro.
 */
export function useDonacionesFundacion(consulta: ConsultaDonaciones) {
  const activa = useActiva();
  return useQuery({
    queryKey: claves.lista(consulta),
    queryFn: () => listarDonaciones(consulta),
    enabled: activa,
    placeholderData: keepPreviousData,
  });
}

/** Tras registrar se invalida el prefijo: lista y totales se refrescan juntos. */
export function useRegistrarDonacionManual() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: DatosDonacionManual) => registrarDonacionManual(datos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: claves.todas }),
  });
}
