import type { Metadata } from 'next';
import { PaginaPlaceholder } from '@/features/panel/components/PaginaPlaceholder';

export const metadata: Metadata = { title: 'Fundaciones por validar | PetHogar' };

export default function Pagina() {
  return (
    <PaginaPlaceholder
      titulo="Fundaciones por validar"
      descripcion="Aquí validarás las fundaciones registradas."
    />
  );
}
