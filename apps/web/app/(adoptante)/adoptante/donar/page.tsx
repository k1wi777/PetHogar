import type { Metadata } from 'next';
import { PaginaPlaceholder } from '@/features/panel/components/PaginaPlaceholder';

export const metadata: Metadata = { title: 'Donar | PetHogar' };

export default function Pagina() {
  return (
    <PaginaPlaceholder
      titulo="Donar"
      descripcion="Aquí podrás registrar una donación a una fundación."
    />
  );
}
