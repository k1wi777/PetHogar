import type { Metadata } from 'next';
import { PantallaNuevaMascota } from '@/features/mascotas-gestion/components/PantallaNuevaMascota';

export const metadata: Metadata = { title: 'Publicar mascota | PetHogar' };

export default function Pagina() {
  return <PantallaNuevaMascota />;
}
