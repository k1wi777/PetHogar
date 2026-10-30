'use client';

import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface OpcionSelector {
  valor: string;
  texto: string;
}

export interface SelectorProps {
  id?: string;
  opciones: ReadonlyArray<OpcionSelector>;
  valor?: string;
  onCambio?: (valor: string) => void;
  placeholder?: string;
  disabled?: boolean;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
  className?: string;
}

/** Lista desplegable accesible (Radix): se opera con teclado y lectores de pantalla. */
export function Selector({
  id,
  opciones,
  valor,
  onCambio,
  placeholder = 'Selecciona una opción',
  disabled,
  className,
  ...aria
}: SelectorProps) {
  return (
    <RadixSelect.Root value={valor} onValueChange={onCambio} disabled={disabled}>
      <RadixSelect.Trigger
        id={id}
        className={cn(
          'bg-card border-border data-[placeholder]:text-muted-foreground flex min-h-11 w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-base aria-invalid:border-destructive aria-invalid:border-2 disabled:opacity-60',
          className,
        )}
        {...aria}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown className="size-4" aria-hidden="true" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className="bg-card border-border-suave z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border shadow-lg"
        >
          <RadixSelect.Viewport className="p-1">
            {opciones.map((o) => (
              <RadixSelect.Item
                key={o.valor}
                value={o.valor}
                className="data-[highlighted]:bg-secondary data-[highlighted]:text-secondary-foreground relative flex min-h-10 cursor-pointer items-center rounded px-8 py-2 text-base select-none"
              >
                <RadixSelect.ItemIndicator className="absolute left-2">
                  <Check className="size-4" aria-hidden="true" />
                </RadixSelect.ItemIndicator>
                <RadixSelect.ItemText>{o.texto}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
