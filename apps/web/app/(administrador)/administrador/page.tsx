import type { Metadata } from 'next';
import { PaginaPlaceholder } from '@/features/panel/components/PaginaPlaceholder';

export const metadata: Metadata = { title: 'Resumen | PetHogar' };

export default function Pagina() {
  return (
    <PaginaPlaceholder titulo="Resumen" descripcion="Las estadísticas globales de la plataforma." />
  );
}
