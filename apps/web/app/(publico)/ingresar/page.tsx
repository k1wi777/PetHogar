import type { Metadata } from 'next';
import { FormularioIngreso } from '@/features/autenticacion/components/FormularioIngreso';

export const metadata: Metadata = { title: 'Ingresar | PetHogar' };

export default async function IngresarPage({
  searchParams,
}: {
  searchParams: Promise<{ siguiente?: string | string[] }>;
}) {
  const { siguiente } = await searchParams;
  return <FormularioIngreso siguiente={Array.isArray(siguiente) ? siguiente[0] : siguiente} />;
}
