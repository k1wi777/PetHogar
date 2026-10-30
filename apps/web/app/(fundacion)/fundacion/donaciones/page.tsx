import type { Metadata } from 'next';
import { PaginaPlaceholder } from '@/features/panel/components/PaginaPlaceholder';

export const metadata: Metadata = { title: 'Donaciones | PetHogar' };

export default function Pagina() {
  return (
    <PaginaPlaceholder titulo="Donaciones" descripcion="Aquí verás y registrarás las donaciones." />
  );
}
