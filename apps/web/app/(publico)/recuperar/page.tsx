import type { Metadata } from 'next';
import { FormularioRecuperacion } from '@/features/autenticacion/components/FormularioRecuperacion';

export const metadata: Metadata = { title: 'Recuperar contraseña | PetHogar' };

export default function RecuperarPage() {
  return <FormularioRecuperacion />;
}
