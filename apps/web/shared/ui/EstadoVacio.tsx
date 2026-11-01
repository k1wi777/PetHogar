import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

export interface EstadoVacioProps {
  titulo: string;
  descripcion?: string;
  icono?: LucideIcon;
  accion?: ReactNode;
  /** `h1` cuando el estado ocupa toda la pantalla (sin otro encabezado de página). */
  encabezado?: 'h1' | 'h2';
}

export function EstadoVacio({
  titulo,
  descripcion,
  icono: Icono = Inbox,
  accion,
  encabezado: Encabezado = 'h2',
}: EstadoVacioProps) {
  return (
    <div className="border-border-suave flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
      <Icono className="text-muted-foreground size-10" aria-hidden="true" />
      <Encabezado className="font-heading text-xl font-bold">{titulo}</Encabezado>
      {descripcion && <p className="text-muted-foreground max-w-prose">{descripcion}</p>}
      {accion}
    </div>
  );
}
