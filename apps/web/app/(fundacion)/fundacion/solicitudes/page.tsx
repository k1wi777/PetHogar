import type { Metadata } from 'next';
import { PaginaPlaceholder } from '@/features/panel/components/PaginaPlaceholder';

export const metadata: Metadata = { title: 'Solicitudes recibidas | PetHogar' };

export default function Pagina() {
  return (
    <PaginaPlaceholder
      titulo="Solicitudes recibidas"
      descripcion="Aquí evaluarás las solicitudes de adopción."
    />
  );
}
