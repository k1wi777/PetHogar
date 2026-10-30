import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/utils';

export const variantesBoton = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-base font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variante: {
        primario: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secundario: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        contorno: 'border border-border bg-card text-foreground hover:bg-muted',
        destructivo: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        fantasma: 'text-foreground hover:bg-muted',
      },
    },
    defaultVariants: { variante: 'primario' },
  },
);

export interface BotonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variantesBoton> {
  /** Renderiza el hijo (p. ej. un enlace) con el estilo del botón. */
  comoHijo?: boolean;
  /** Muestra un indicador y deshabilita el botón mientras se procesa. */
  cargando?: boolean;
}

export function Boton({
  className,
  variante,
  comoHijo = false,
  cargando = false,
  disabled,
  children,
  type = 'button',
  ...props
}: BotonProps) {
  const clases = cn(variantesBoton({ variante }), className);
  if (comoHijo) {
    return (
      <Slot className={clases} {...props}>
        {children}
      </Slot>
    );
  }
  return (
    <button
      type={type}
      className={clases}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      {...props}
    >
      {cargando && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
