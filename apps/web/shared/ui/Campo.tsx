'use client';

import {
  cloneElement,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '@/shared/lib/utils';

interface PropsControl {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
}

export interface CampoProps {
  etiqueta: string;
  /** El control (p. ej. `<Entrada />`); recibe `id`, `aria-describedby` y `aria-invalid`. */
  children: ReactElement<PropsControl>;
  ayuda?: ReactNode;
  error?: string;
  requerido?: boolean;
  className?: string;
}

/** Etiqueta + control + ayuda + error, enlazados para lectores de pantalla. */
export function Campo({ etiqueta, children, ayuda, error, requerido, className }: CampoProps) {
  const base = useId();
  const idControl = children.props.id ?? `${base}-control`;
  const idAyuda = `${base}-ayuda`;
  const idError = `${base}-error`;
  const descritoPor =
    [ayuda ? idAyuda : null, error ? idError : null].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: idControl,
        'aria-describedby': descritoPor,
        'aria-invalid': error ? true : undefined,
        'aria-required': requerido ? true : undefined,
      })
    : children;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={idControl} className="text-base font-semibold">
        {etiqueta}
        {requerido && (
          <span aria-hidden="true" className="text-destructive">
            {' '}
            *
          </span>
        )}
      </label>
      {control}
      {ayuda && (
        <p id={idAyuda} className="text-muted-foreground text-sm">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idError} role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      )}
    </div>
  );
}

export function Entrada({
  className,
  type = 'text',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        'bg-card border-border placeholder:text-muted-foreground min-h-11 w-full rounded-md border px-3 py-2 text-base aria-invalid:border-destructive aria-invalid:border-2 disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}
