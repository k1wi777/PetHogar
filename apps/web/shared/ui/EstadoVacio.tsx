import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

export interface EstadoVacioProps {
  titulo: string;
  descripcion?: string;
  icono?: LucideIcon;
  accion?: ReactNode;
}

export function EstadoVacio({
  titulo,
  descripcion,
  icono: Icono = Inbox,
  accion,
}: EstadoVacioProps) {
  return (
    <div className="border-border-suave flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
      <Icono className="text-muted-foreground size-10" aria-hidden="true" />
      <h2 className="font-heading text-xl font-bold">{titulo}</h2>
      {descripcion && <p className="text-muted-foreground max-w-prose">{descripcion}</p>}
      {accion}
    </div>
  );
}
