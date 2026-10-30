import type { Metadata } from 'next';
import { PaginaPlaceholder } from '@/features/panel/components/PaginaPlaceholder';

export const metadata: Metadata = { title: 'Adopciones y seguimientos | PetHogar' };

export default function Pagina() {
  return (
    <PaginaPlaceholder
      titulo="Adopciones y seguimientos"
      descripcion="Aquí darás seguimiento a las adopciones."
    />
  );
}
