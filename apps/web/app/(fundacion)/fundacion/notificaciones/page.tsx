import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PantallaNotificaciones } from '@/features/notificaciones/components/PantallaNotificaciones';
import { Skeleton } from '@/shared/ui/Skeleton';

export const metadata: Metadata = { title: 'Notificaciones | PetHogar' };

export default function Pagina() {
  return (
    <Suspense fallback={<Skeleton className="h-48 max-w-3xl" etiqueta="Cargando" />}>
      <PantallaNotificaciones />
    </Suspense>
  );
}
