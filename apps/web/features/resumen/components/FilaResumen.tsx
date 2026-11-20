import Link from 'next/link';
import type { ReactNode } from 'react';
import { BadgeEstado } from '@/shared/ui/BadgeEstado';

/** Fila de un elemento reciente; el enlace lleva a su detalle y no se anida en otros enlaces. */
export function FilaResumen({
  href,
  contexto,
  titulo,
  detalle,
  estado,
}: {
  /** Sin `href` la fila es solo informativa (no existe una pantalla de detalle). */
  href?: string;
  /** Texto solo para lectores de pantalla que da contexto al título («Solicitud de»). */
  contexto?: string;
  titulo: string;
  detalle?: string;
  estado?: string;
}) {
  const clases =
    'flex min-h-11 min-w-0 flex-wrap items-center justify-between gap-2 rounded-md px-2 py-2';
  const cuerpo = (
    <>
      <span className="min-w-0 break-words">
        {contexto && <span className="sr-only">{contexto}</span>}
        {contexto && ' '}
        <span className="font-semibold">{titulo}</span>
        {detalle && <span className="text-muted-foreground block text-sm">{detalle}</span>}
      </span>
      {estado && ' '}
      {estado && <BadgeEstado estado={estado} />}
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className={`${clases} hover:bg-muted`}>
          {cuerpo}
        </Link>
      ) : (
        <div className={clases}>{cuerpo}</div>
      )}
    </li>
  );
}

export function ListaFilas({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <ul aria-label={etiqueta} className="flex min-w-0 flex-col gap-1">
      {children}
    </ul>
  );
}
