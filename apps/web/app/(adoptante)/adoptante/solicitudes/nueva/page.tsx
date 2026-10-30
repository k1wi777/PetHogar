import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PantallaNuevaSolicitud } from '@/features/solicitudes/components/PantallaNuevaSolicitud';
import { Skeleton } from '@/shared/ui/Skeleton';

export const metadata: Metadata = { title: 'Solicitar adopción | PetHogar' };

export default function Pagina() {
  return (
    <Suspense fallback={<Skeleton className="h-64 max-w-2xl" etiqueta="Cargando" />}>
      <PantallaNuevaSolicitud />
    </Suspense>
  );
}
