import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FichaGestion } from '@/features/mascotas-gestion/components/FichaGestion';
import { Skeleton } from '@/shared/ui/Skeleton';

export const metadata: Metadata = { title: 'Ficha de la mascota | PetHogar' };

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<Skeleton className="h-64 max-w-4xl" etiqueta="Cargando" />}>
      <FichaGestion idTexto={id} />
    </Suspense>
  );
}
