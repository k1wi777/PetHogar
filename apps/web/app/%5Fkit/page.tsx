import { notFound } from 'next/navigation';
import { KitComponentes } from './KitComponentes';

/** Catálogo de componentes: solo existe en desarrollo (R4). */
export default function KitPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <KitComponentes />;
}
