import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PantallaAdopciones } from '@/features/adopciones-gestion/components/PantallaAdopciones';
import { Skeleton } from '@/shared/ui/Skeleton';

export const metadata: Metadata = { title: 'Adopciones y seguimientos | PetHogar' };

export default function Pagina() {
  return (
    <Suspense fallback={<Skeleton className="h-48 max-w-4xl" etiqueta="Cargando" />}>
      <PantallaAdopciones />
    </Suspense>
  );
}
