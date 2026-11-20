import type { Metadata } from 'next';
import { PantallaResumenAdoptante } from '@/features/resumen/components/PantallaResumenAdoptante';

export const metadata: Metadata = { title: 'Inicio | PetHogar' };

export default function Pagina() {
  return <PantallaResumenAdoptante />;
}
