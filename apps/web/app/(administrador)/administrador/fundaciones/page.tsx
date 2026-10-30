import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PantallaFundaciones } from '@/features/admin-fundaciones/components/PantallaFundaciones';
import { Skeleton } from '@/shared/ui/Skeleton';

export const metadata: Metadata = { title: 'Fundaciones por validar | PetHogar' };

export default function Pagina() {
  return (
    <Suspense fallback={<Skeleton className="h-48 max-w-4xl" etiqueta="Cargando" />}>
      <PantallaFundaciones />
    </Suspense>
  );
}
