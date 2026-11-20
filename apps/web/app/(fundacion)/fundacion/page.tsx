import type { Metadata } from 'next';
import { PantallaResumenFundacion } from '@/features/resumen/components/PantallaResumenFundacion';

export const metadata: Metadata = { title: 'Resumen | PetHogar' };

export default function Pagina() {
  return <PantallaResumenFundacion />;
}
