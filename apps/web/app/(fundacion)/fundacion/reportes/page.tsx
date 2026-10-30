import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PantallaReportes } from '@/features/reportes/components/PantallaReportes';
import { Skeleton } from '@/shared/ui/Skeleton';

export const metadata: Metadata = { title: 'Reportes | PetHogar' };

export default function Pagina() {
  return (
    <Suspense fallback={<Skeleton className="h-64 max-w-5xl" etiqueta="Cargando" />}>
      <PantallaReportes ambito="fundacion" />
    </Suspense>
  );
}
