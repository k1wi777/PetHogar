import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PantallaDonacionesFundacion } from '@/features/donaciones-gestion/components/PantallaDonacionesFundacion';
import { Skeleton } from '@/shared/ui/Skeleton';

export const metadata: Metadata = { title: 'Donaciones | PetHogar' };

export default function Pagina() {
  return (
    <Suspense fallback={<Skeleton className="h-48 max-w-4xl" etiqueta="Cargando" />}>
      <PantallaDonacionesFundacion />
    </Suspense>
  );
}
