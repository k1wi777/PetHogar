'use client';

import { Info } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

/** Mensaje de página completa (solicitud duplicada, mascota no disponible) con su acción. */
export function MensajeAviso({
  titulo,
  mensaje,
  children,
}: {
  titulo: string;
  mensaje: string;
  children?: ReactNode;
}) {
  const titulo_ = useRef<HTMLHeadingElement>(null);
  // El mensaje reemplaza al formulario: el foco pasa al título para no perderse en <body>.
  useEffect(() => titulo_.current?.focus(), []);
  return (
    <div className="border-border-suave bg-card flex max-w-xl flex-col items-start gap-3 rounded-lg border p-6">
      <Info className="text-info-foreground size-10" aria-hidden="true" />
      <h1 ref={titulo_} tabIndex={-1} className="text-2xl focus:outline-none">
        {titulo}
      </h1>
      <p role="status">{mensaje}</p>
      {children}
    </div>
  );
}
