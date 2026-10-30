import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ListaSolicitudes } from '@/features/solicitudes/components/ListaSolicitudes';
import { Skeleton } from '@/shared/ui/Skeleton';

export const metadata: Metadata = { title: 'Mis solicitudes | PetHogar' };

export default function Pagina() {
  return (
    <Suspense fallback={<Skeleton className="h-48 max-w-4xl" etiqueta="Cargando" />}>
      <ListaSolicitudes />
    </Suspense>
  );
}
