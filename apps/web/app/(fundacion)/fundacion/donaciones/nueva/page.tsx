import type { Metadata } from 'next';
import { PantallaNuevaDonacion } from '@/features/donaciones-gestion/components/PantallaNuevaDonacion';

export const metadata: Metadata = { title: 'Registrar aporte | PetHogar' };

export default function Pagina() {
  return <PantallaNuevaDonacion />;
}
