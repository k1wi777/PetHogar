import type { Metadata } from 'next';
import { PaginaPlaceholder } from '@/features/panel/components/PaginaPlaceholder';

export const metadata: Metadata = { title: 'Mis solicitudes | PetHogar' };

export default function Pagina() {
  return (
    <PaginaPlaceholder
      titulo="Mis solicitudes"
      descripcion="Aquí verás el estado de tus solicitudes de adopción."
    />
  );
}
