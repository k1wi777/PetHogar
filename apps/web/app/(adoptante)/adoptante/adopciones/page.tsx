import type { Metadata } from 'next';
import { PaginaPlaceholder } from '@/features/panel/components/PaginaPlaceholder';

export const metadata: Metadata = { title: 'Mis adopciones | PetHogar' };

export default function Pagina() {
  return (
    <PaginaPlaceholder
      titulo="Mis adopciones"
      descripcion="Aquí verás tus adopciones y sus seguimientos."
    />
  );
}
