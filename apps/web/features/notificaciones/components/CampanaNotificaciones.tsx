'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useNoLeidas } from '../hooks/useNoLeidas';

export const TOPE_VISIBLE = 99;

export function etiquetaNotificaciones(cantidad: number | undefined): string {
  if (cantidad === undefined) return 'Notificaciones';
  if (cantidad === 0) return 'Notificaciones, ninguna sin leer';
  return `Notificaciones, ${cantidad} sin leer`;
}

/** Ícono de notificaciones con contador; si el contador falla se muestra sin cifra. */
export function CampanaNotificaciones({ href }: { href: string }) {
  const { data } = useNoLeidas();
  return (
    <Link
      href={href}
      aria-label={etiquetaNotificaciones(data)}
      className="hover:bg-muted relative inline-flex size-11 items-center justify-center rounded-md"
    >
      <Bell className="size-6" aria-hidden="true" />
      {data !== undefined && data > 0 && (
        <span
          aria-hidden="true"
          className="bg-destructive text-destructive-foreground absolute top-0.5 right-0.5 min-w-5 rounded-full px-1 text-center text-xs font-bold"
        >
          {data > TOPE_VISIBLE ? `${TOPE_VISIBLE}+` : data}
        </span>
      )}
    </Link>
  );
}
