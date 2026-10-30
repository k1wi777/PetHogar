import type { Metadata } from 'next';
import { PaginaPlaceholder } from '@/features/panel/components/PaginaPlaceholder';

export const metadata: Metadata = { title: 'Usuarios | PetHogar' };

export default function Pagina() {
  return (
    <PaginaPlaceholder titulo="Usuarios" descripcion="Aquí gestionarás las cuentas de usuario." />
  );
}
