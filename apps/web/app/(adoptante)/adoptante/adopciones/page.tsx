import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ListaAdopciones } from '@/features/adopciones/components/ListaAdopciones';
import { Skeleton } from '@/shared/ui/Skeleton';

export const metadata: Metadata = { title: 'Mis adopciones | PetHogar' };

export default function Pagina() {
  return (
    <Suspense fallback={<Skeleton className="h-48 max-w-4xl" etiqueta="Cargando" />}>
      <ListaAdopciones />
    </Suspense>
  );
}
