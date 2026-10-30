import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PantallaUsuarios } from '@/features/admin-usuarios/components/PantallaUsuarios';
import { Skeleton } from '@/shared/ui/Skeleton';

export const metadata: Metadata = { title: 'Usuarios | PetHogar' };

export default function Pagina() {
  return (
    <Suspense fallback={<Skeleton className="h-48 max-w-5xl" etiqueta="Cargando" />}>
      <PantallaUsuarios />
    </Suspense>
  );
}
