'use client';

import * as Tabs from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

export interface Pestana {
  valor: string;
  etiqueta: string;
  contenido: ReactNode;
}

export interface PestanasProps {
  /** Describe el conjunto de pestañas a los lectores de pantalla. */
  etiqueta: string;
  pestanas: ReadonlyArray<Pestana>;
  valor: string;
  onCambio: (valor: string) => void;
  className?: string;
}

/**
 * Pestañas accesibles (Radix Tabs): flechas, Inicio y Fin mueven entre pestañas y cada panel
 * queda enlazado a su pestaña. El panel inactivo no se monta, así no lanza peticiones de más.
 */
export function Pestanas({ etiqueta, pestanas, valor, onCambio, className }: PestanasProps) {
  return (
    <Tabs.Root value={valor} onValueChange={onCambio} className={className}>
      <Tabs.List
        aria-label={etiqueta}
        className="border-border-suave flex gap-1 overflow-x-auto border-b"
      >
        {pestanas.map((p) => (
          <Tabs.Trigger
            key={p.valor}
            value={p.valor}
            className={cn(
              'min-h-11 shrink-0 rounded-t-md border-b-4 border-transparent px-4 py-2 text-base font-semibold',
              'hover:bg-muted data-[state=active]:border-primary data-[state=active]:text-primary',
            )}
          >
            {p.etiqueta}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {pestanas.map((p) => (
        <Tabs.Content key={p.valor} value={p.valor} className="pt-6">
          {p.contenido}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
