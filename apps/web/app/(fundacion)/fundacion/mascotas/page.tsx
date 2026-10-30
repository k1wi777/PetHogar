import type { Metadata } from 'next';
import { PaginaPlaceholder } from '@/features/panel/components/PaginaPlaceholder';

export const metadata: Metadata = { title: 'Mis mascotas | PetHogar' };

export default function Pagina() {
  return (
    <PaginaPlaceholder
      titulo="Mis mascotas"
      descripcion="Aquí gestionarás las mascotas de tu fundación."
    />
  );
}
