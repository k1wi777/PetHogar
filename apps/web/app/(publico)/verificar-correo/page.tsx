import type { Metadata } from 'next';
import { VerificacionCorreo } from '@/features/autenticacion/components/VerificacionCorreo';

export const metadata: Metadata = { title: 'Verificar correo | PetHogar' };

export default async function VerificarCorreoPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  return <VerificacionCorreo token={Array.isArray(token) ? token[0] : token} />;
}
