import type { Metadata } from 'next';
import { FormularioRegistroFundacion } from '@/features/autenticacion/components/FormularioRegistroFundacion';

export const metadata: Metadata = { title: 'Registrar fundación | PetHogar' };

export default function RegistroFundacionPage() {
  return <FormularioRegistroFundacion />;
}
