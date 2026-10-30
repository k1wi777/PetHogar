import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

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
  return (
    <div className="border-border-suave bg-card flex max-w-xl flex-col items-start gap-3 rounded-lg border p-6">
      <Info className="text-info-foreground size-10" aria-hidden="true" />
      <h1 className="text-2xl">{titulo}</h1>
      <p role="status">{mensaje}</p>
      {children}
    </div>
  );
}
