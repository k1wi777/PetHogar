import type { Metadata } from 'next';
import { PaginaPlaceholder } from '@/features/panel/components/PaginaPlaceholder';

export const metadata: Metadata = { title: 'Notificaciones | PetHogar' };

export default function Pagina() {
  return <PaginaPlaceholder titulo="Notificaciones" descripcion="Aquí verás tus avisos." />;
}
