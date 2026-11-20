import Link from 'next/link';
import { Boton } from '@/shared/ui/Boton';

export interface Acceso {
  href: string;
  texto: string;
  principal?: boolean;
}

export function AccesosRapidos({ accesos }: { accesos: readonly Acceso[] }) {
  return (
    <section aria-label="Accesos rápidos" className="min-w-0">
      <h2 className="sr-only">Accesos rápidos</h2>
      <ul className="flex flex-wrap gap-3">
        {accesos.map((a) => (
          <li key={a.href} className="max-w-full">
            <Boton comoHijo variante={a.principal ? 'primario' : 'contorno'} className="max-w-full">
              <Link href={a.href}>{a.texto}</Link>
            </Boton>
          </li>
        ))}
      </ul>
    </section>
  );
}
