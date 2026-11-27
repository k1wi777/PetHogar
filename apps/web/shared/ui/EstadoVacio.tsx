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
    <div className="border-border-suave bg-card flex flex-col items-center gap-3 rounded-xl border px-6 py-10 text-center">
      <span className="bg-secondary text-primary mb-1 flex size-20 items-center justify-center rounded-full">
        <Icono className="size-10" aria-hidden="true" />
      </span>
      <Encabezado className="font-heading text-2xl font-extrabold">{titulo}</Encabezado>
      {descripcion && <p className="text-muted-foreground max-w-prose">{descripcion}</p>}
      {accion}
    </div>
  );
}
