import type { Metadata } from 'next';
import { PaginaPlaceholder } from '@/features/panel/components/PaginaPlaceholder';

export const metadata: Metadata = { title: 'Reportes | PetHogar' };

export default function Pagina() {
  return (
    <PaginaPlaceholder
      titulo="Reportes"
      descripcion="Aquí consultarás los reportes de la plataforma."
    />
  );
}
