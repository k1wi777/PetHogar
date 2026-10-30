import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PantallaDetalleFundacion } from '@/features/admin-fundaciones/components/PantallaDetalleFundacion';
import { Skeleton } from '@/shared/ui/Skeleton';

export const metadata: Metadata = { title: 'Revisar fundación | PetHogar' };

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<Skeleton className="h-64 max-w-3xl" etiqueta="Cargando" />}>
      <PantallaDetalleFundacion idTexto={id} />
    </Suspense>
  );
}
