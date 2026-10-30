import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PantallaMisMascotas } from '@/features/mascotas-gestion/components/PantallaMisMascotas';
import { Skeleton } from '@/shared/ui/Skeleton';

export const metadata: Metadata = { title: 'Mis mascotas | PetHogar' };

export default function Pagina() {
  return (
    <Suspense fallback={<Skeleton className="h-48 max-w-4xl" etiqueta="Cargando" />}>
      <PantallaMisMascotas />
    </Suspense>
  );
}
