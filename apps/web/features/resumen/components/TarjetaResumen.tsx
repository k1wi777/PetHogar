import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

export interface EnlaceResumen {
  href: string;
  texto: string;
}

/** Marco común de cada sección del resumen: `section` con `h2` y, opcional, un enlace «Ver todas». */
export function TarjetaResumen({
  titulo,
  enlace,
  ocupada = false,
  className,
  children,
}: {
  titulo: string;
  enlace?: EnlaceResumen;
  /** Mientras carga: anuncia que la tarjeta está ocupada. */
  ocupada?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={titulo}
      aria-busy={ocupada || undefined}
      className={cn(
        'bg-card border-border-suave flex min-w-0 flex-col gap-4 rounded-lg border p-5',
        className,
      )}
    >
      <h2 className="font-heading text-xl font-bold break-words">{titulo}</h2>
      {children}
      {enlace && (
        <Link
          href={enlace.href}
          className="text-primary inline-flex min-h-11 items-center font-semibold underline"
        >
          {enlace.texto}
        </Link>
      )}
    </section>
  );
}
