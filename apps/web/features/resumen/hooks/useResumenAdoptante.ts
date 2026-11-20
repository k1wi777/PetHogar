'use client';

import { useQuery } from '@tanstack/react-query';
import { useSesion } from '@/shared/auth/SesionProvider';
import {
  listarMisAdopcionesActivas,
  listarMisSeguimientos,
  listarMisSolicitudes,
  RECIENTES,
} from '../api/adoptante';
import { contarNoLeidasResumen } from '../api/notificaciones';
import { resumirSeguimientos } from '../lib/seguimientos';
import { claves } from './claves';

/** Una consulta por sección: el fallo de una no tumba las demás. Solo con sesión. */
export function useResumenAdoptante() {
  const { estado } = useSesion();
  const enabled = estado === 'autenticado';

  const solicitudes = useQuery({
    queryKey: claves.adoptante.solicitudes,
    enabled,
    queryFn: async () => {
      const [recientes, pendientes] = await Promise.all([
        listarMisSolicitudes({ limite: RECIENTES }),
        listarMisSolicitudes({ estado: 'pendiente', limite: 1 }),
      ]);
      return { total: recientes.total, pendientes: pendientes.total, recientes: recientes.data };
    },
  });
  const adopciones = useQuery({
    queryKey: claves.adoptante.adopciones,
    enabled,
    queryFn: () => listarMisAdopcionesActivas(),
  });
  const seguimientos = useQuery({
    queryKey: claves.adoptante.seguimientos,
    enabled,
    queryFn: async () => {
      const [vencidos, programados] = await Promise.all([
        listarMisSeguimientos('vencido'),
        listarMisSeguimientos('programado'),
      ]);
      return resumirSeguimientos(vencidos, programados);
    },
  });
  const notificaciones = useQuery({
    queryKey: claves.noLeidas,
    enabled,
    queryFn: () => contarNoLeidasResumen(),
    select: (d) => d.noLeidas,
  });

  return { solicitudes, adopciones, seguimientos, notificaciones };
}
