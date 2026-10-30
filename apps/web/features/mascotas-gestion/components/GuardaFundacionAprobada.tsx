'use client';

import type { ReactNode } from 'react';
import { useSesion } from '@/shared/auth/SesionProvider';
import { AvisoFundacionNoAprobada } from './AvisoFundacionNoAprobada';

/**
 * Envuelve las pantallas de gestión de mascotas: con la fundación pendiente o rechazada muestra el
 * aviso y no monta el contenido, así no se lanzan peticiones que el backend rechazaría con 403.
 */
export function GuardaFundacionAprobada({ children }: { children: ReactNode }) {
  const { usuario } = useSesion();
  if (usuario?.fundacion?.estadoValidacion !== 'aprobada') return <AvisoFundacionNoAprobada />;
  return <>{children}</>;
}
