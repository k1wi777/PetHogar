import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PantallaDonar } from '@/features/donaciones/components/PantallaDonar';
import { Skeleton } from '@/shared/ui/Skeleton';

export const metadata: Metadata = { title: 'Donar | PetHogar' };

export default function Pagina() {
  return (
    <Suspense fallback={<Skeleton className="h-64 max-w-2xl" etiqueta="Cargando" />}>
      <PantallaDonar />
    </Suspense>
  );
}
