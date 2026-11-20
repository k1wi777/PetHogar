'use client';

import { useQuery } from '@tanstack/react-query';
import { useSesion } from '@/shared/auth/SesionProvider';
import { hoyEnBogota, primerDiaDelMes, ultimoDiaDelMes } from '@/shared/lib/fechas';
import {
  contarMascotas,
  listarDonacionesDelMes,
  listarSeguimientosFundacion,
  listarSolicitudesPendientes,
} from '../api/fundacion';
import { contarNoLeidasResumen } from '../api/notificaciones';
import { resumirSeguimientos } from '../lib/seguimientos';
import { ESTADOS_MASCOTA_RESUMEN, type EstadoMascota } from '../types';
import { claves } from './claves';

/**
 * Solo con sesión y fundación aprobada (con otro estado el backend respondería 403). El mes en
 * curso es el de Bogotá, nunca el del navegador.
 */
export function useResumenFundacion() {
  const { estado, usuario } = useSesion();
  const enabled = estado === 'autenticado' && usuario?.fundacion?.estadoValidacion === 'aprobada';
  const hoy = hoyEnBogota();
  const desde = primerDiaDelMes(hoy);
  const hasta = ultimoDiaDelMes(hoy);

  const mascotas = useQuery({
    queryKey: claves.fundacion.mascotas,
    enabled,
    queryFn: async () => {
      const paginas = await Promise.all(ESTADOS_MASCOTA_RESUMEN.map((e) => contarMascotas(e)));
      return Object.fromEntries(
        ESTADOS_MASCOTA_RESUMEN.map((e, i) => [e, paginas[i]!.total]),
      ) as Record<EstadoMascota, number>;
    },
  });
  const solicitudes = useQuery({
    queryKey: claves.fundacion.solicitudes,
    enabled,
    queryFn: () => listarSolicitudesPendientes(),
  });
  const seguimientos = useQuery({
    queryKey: claves.fundacion.seguimientos,
    enabled,
    queryFn: async () => {
      const [vencidos, programados] = await Promise.all([
        listarSeguimientosFundacion('vencido'),
        listarSeguimientosFundacion('programado'),
      ]);
      return resumirSeguimientos(vencidos, programados);
    },
  });
  const donaciones = useQuery({
    queryKey: claves.fundacion.donaciones(desde, hasta),
    enabled,
    queryFn: () => listarDonacionesDelMes({ desde, hasta }),
  });
  const notificaciones = useQuery({
    queryKey: claves.noLeidas,
    enabled,
    queryFn: () => contarNoLeidasResumen(),
    select: (d) => d.noLeidas,
  });

  return { mascotas, solicitudes, seguimientos, donaciones, notificaciones };
}
