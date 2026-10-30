import type { Metadata } from 'next';
import { PaginaPlaceholder } from '@/features/panel/components/PaginaPlaceholder';

export const metadata: Metadata = { title: 'Resumen | PetHogar' };

export default function Pagina() {
  return <PaginaPlaceholder titulo="Resumen" descripcion="El resumen de tu fundación." />;
}
