import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PantallaRevisionSolicitud } from '@/features/solicitudes-gestion/components/PantallaRevisionSolicitud';
import { Skeleton } from '@/shared/ui/Skeleton';

export const metadata: Metadata = { title: 'Revisar solicitud | PetHogar' };

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<Skeleton className="h-64 max-w-3xl" etiqueta="Cargando" />}>
      <PantallaRevisionSolicitud idTexto={id} />
    </Suspense>
  );
}
