import type { Metadata } from 'next';
import { SinPermiso } from '@/shared/ui/PaginaMensaje';

export const metadata: Metadata = { title: 'Sin permiso | PetHogar' };

export default function Pagina403() {
  return <SinPermiso />;
}
