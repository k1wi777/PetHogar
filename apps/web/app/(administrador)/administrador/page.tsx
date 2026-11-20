import type { Metadata } from 'next';
import { PantallaResumenAdministrador } from '@/features/resumen/components/PantallaResumenAdministrador';

export const metadata: Metadata = { title: 'Resumen | PetHogar' };

export default function Pagina() {
  return <PantallaResumenAdministrador />;
}
