import type { Metadata } from 'next';
import { FormularioRegistroAdoptante } from '@/features/autenticacion/components/FormularioRegistroAdoptante';

export const metadata: Metadata = { title: 'Crear cuenta | PetHogar' };

export default function RegistroPage() {
  return <FormularioRegistroAdoptante />;
}
