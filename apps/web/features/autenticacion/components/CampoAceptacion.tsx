'use client';

import { useId, type ReactNode } from 'react';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';

/** Casilla obligatoria (política de datos) con su error asociado por `aria-describedby`. */
export function CampoAceptacion<T extends FieldValues>({
  control,
  nombre,
  children,
}: {
  control: Control<T>;
  nombre: Path<T>;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={nombre}
      render={({ field, fieldState }) => {
        const idError = `${id}-error`;
        return (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-start gap-3">
              <input
                id={id}
                type="checkbox"
                name={field.name}
                ref={field.ref}
                checked={field.value === true}
                onChange={(e) => field.onChange(e.target.checked)}
                onBlur={field.onBlur}
                aria-required="true"
                aria-invalid={fieldState.error ? true : undefined}
                aria-describedby={fieldState.error ? idError : undefined}
                className="mt-1 size-6 shrink-0"
              />
              <label htmlFor={id} className="text-base">
                {children}
              </label>
            </div>
            {fieldState.error && (
              <p id={idError} role="alert" className="text-destructive text-sm font-medium">
                {fieldState.error.message}
              </p>
            )}
          </div>
        );
      }}
    />
  );
}
