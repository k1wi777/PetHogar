import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PantallaSeguimientoFundacion } from '@/features/adopciones-gestion/components/PantallaSeguimientoFundacion';
import { Skeleton } from '@/shared/ui/Skeleton';

export const metadata: Metadata = { title: 'Seguimiento | PetHogar' };

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<Skeleton className="h-64 max-w-3xl" etiqueta="Cargando" />}>
      <PantallaSeguimientoFundacion idTexto={id} />
    </Suspense>
  );
}
