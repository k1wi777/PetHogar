import Link from 'next/link';
import { Boton } from '@/shared/ui/Boton';

/** Enlace con aspecto de botón para la acción de un estado vacío. */
export function EnlaceAccion({ href, children }: { href: string; children: string }) {
  return (
    <Boton comoHijo>
      <Link href={href}>{children}</Link>
    </Boton>
  );
}
