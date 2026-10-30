import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DetalleSolicitud } from '@/features/solicitudes/components/DetalleSolicitud';
import { Skeleton } from '@/shared/ui/Skeleton';

export const metadata: Metadata = { title: 'Detalle de la solicitud | PetHogar' };

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<Skeleton className="h-64 max-w-3xl" etiqueta="Cargando" />}>
      <DetalleSolicitud idTexto={id} />
    </Suspense>
  );
}
