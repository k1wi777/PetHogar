import type { Metadata } from 'next';
import { PaginaPlaceholder } from '@/features/panel/components/PaginaPlaceholder';

export const metadata: Metadata = { title: 'Inicio | PetHogar' };

export default function Pagina() {
  return (
    <PaginaPlaceholder titulo="Inicio" descripcion="Tu resumen de solicitudes y adopciones." />
  );
}
