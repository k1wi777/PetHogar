import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PantallaSolicitudesRecibidas } from '@/features/solicitudes-gestion/components/PantallaSolicitudesRecibidas';
import { Skeleton } from '@/shared/ui/Skeleton';

export const metadata: Metadata = { title: 'Solicitudes recibidas | PetHogar' };

export default function Pagina() {
  return (
    <Suspense fallback={<Skeleton className="h-48 max-w-4xl" etiqueta="Cargando" />}>
      <PantallaSolicitudesRecibidas />
    </Suspense>
  );
}
