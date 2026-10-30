import type { Metadata } from 'next';
import { PantallaSeguimiento } from '@/features/adopciones/components/PantallaSeguimiento';

export const metadata: Metadata = { title: 'Seguimiento | PetHogar' };

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PantallaSeguimiento idTexto={id} />;
}
