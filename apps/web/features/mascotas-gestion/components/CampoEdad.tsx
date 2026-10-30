'use client';

import { useId } from 'react';
import { Controller, type Control } from 'react-hook-form';
import { Entrada } from '@/shared/ui/Campo';
import type { ValoresMascota } from '../schemas/mascota';

/** Edad en años y meses (se envía como meses): dos números agrupados en un fieldset con un único error. */
export function CampoEdad({
  control,
  deshabilitado,
}: {
  control: Control<ValoresMascota>;
  deshabilitado?: boolean;
}) {
  const base = useId();
  return (
    <Controller
      control={control}
      name="anios"
      render={({ field: anios, fieldState: errorAnios }) => (
        <Controller
          control={control}
          name="meses"
          render={({ field: meses, fieldState: errorMeses }) => {
            const error = errorAnios.error?.message ?? errorMeses.error?.message;
            const idError = `${base}-error`;
            const idAyuda = `${base}-ayuda`;
            return (
              <fieldset
                className="flex flex-col gap-2"
                aria-describedby={`${idAyuda}${error ? ` ${idError}` : ''}`}
              >
                <legend className="text-base font-semibold">
                  Edad
                  <span aria-hidden="true" className="text-destructive">
                    {' '}
                    *
                  </span>
                </legend>
                <p id={idAyuda} className="text-muted-foreground text-sm">
                  Si es menor de un año, deja los años en 0 y escribe solo los meses.
                </p>
                <div className="flex flex-wrap gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`${base}-anios`} className="text-base">
                      Años
                    </label>
                    <Entrada
                      id={`${base}-anios`}
                      inputMode="numeric"
                      autoComplete="off"
                      className="w-28"
                      aria-invalid={errorAnios.error ? true : undefined}
                      disabled={deshabilitado}
                      name={anios.name}
                      ref={anios.ref}
                      value={anios.value ?? ''}
                      onChange={anios.onChange}
                      onBlur={anios.onBlur}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`${base}-meses`} className="text-base">
                      Meses
                    </label>
                    <Entrada
                      id={`${base}-meses`}
                      inputMode="numeric"
                      autoComplete="off"
                      className="w-28"
                      aria-invalid={errorMeses.error ? true : undefined}
                      disabled={deshabilitado}
                      name={meses.name}
                      ref={meses.ref}
                      value={meses.value ?? ''}
                      onChange={meses.onChange}
                      onBlur={meses.onBlur}
                    />
                  </div>
                </div>
                {error && (
                  <p id={idError} role="alert" className="text-destructive text-sm font-medium">
                    {error}
                  </p>
                )}
              </fieldset>
            );
          }}
        />
      )}
    />
  );
}
