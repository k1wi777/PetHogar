'use client';

import { useId } from 'react';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';

export interface OpcionRadio {
  /** Valor de texto del radio (no el del formulario). */
  valor: string;
  texto: string;
}

/**
 * Grupo de opciones nativas (fieldset con leyenda): se opera con teclado y lectores de pantalla.
 * `aTexto`/`aValor` traducen entre el valor del formulario y el texto de la opción, para
 * poder usar booleanos; sin valor elegido ningún radio está marcado.
 */
export function GrupoRadio<T extends FieldValues>({
  control,
  nombre,
  leyenda,
  opciones,
  ayuda,
  requerido,
  aTexto = (v) => (v == null ? '' : String(v)),
  aValor = (t) => t,
}: {
  control: Control<T>;
  nombre: Path<T>;
  leyenda: string;
  opciones: ReadonlyArray<OpcionRadio>;
  ayuda?: string;
  requerido?: boolean;
  aTexto?: (valor: unknown) => string;
  aValor?: (texto: string) => unknown;
}) {
  const base = useId();
  return (
    <Controller
      control={control}
      name={nombre}
      render={({ field, fieldState }) => {
        const idError = `${base}-error`;
        const idAyuda = `${base}-ayuda`;
        const descritoPor =
          [ayuda ? idAyuda : null, fieldState.error ? idError : null].filter(Boolean).join(' ') ||
          undefined;
        return (
          <fieldset
            className="flex flex-col gap-2"
            aria-describedby={descritoPor}
            aria-required={requerido || undefined}
          >
            <legend className="text-base font-semibold">
              {leyenda}
              {requerido && (
                <span aria-hidden="true" className="text-destructive">
                  {' '}
                  *
                </span>
              )}
            </legend>
            {ayuda && (
              <p id={idAyuda} className="text-muted-foreground text-sm">
                {ayuda}
              </p>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {opciones.map((o, i) => {
                const id = `${base}-${o.valor}`;
                return (
                  <div key={o.valor} className="flex min-h-11 items-center gap-2">
                    <input
                      id={id}
                      type="radio"
                      name={field.name}
                      ref={i === 0 ? field.ref : undefined}
                      value={o.valor}
                      checked={aTexto(field.value) === o.valor}
                      onChange={() => field.onChange(aValor(o.valor))}
                      onBlur={field.onBlur}
                      className="size-5"
                    />
                    <label htmlFor={id} className="text-base">
                      {o.texto}
                    </label>
                  </div>
                );
              })}
            </div>
            {fieldState.error && (
              <p id={idError} role="alert" className="text-destructive text-sm font-medium">
                {fieldState.error.message}
              </p>
            )}
          </fieldset>
        );
      }}
    />
  );
}
