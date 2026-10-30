'use client';

import type { ComponentProps, ReactNode } from 'react';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { AreaTexto, Campo, Entrada } from './Campo';
import { Selector, type OpcionSelector } from './Selector';

interface PropsBase<T extends FieldValues> {
  control: Control<T>;
  nombre: Path<T>;
  etiqueta: string;
  ayuda?: ReactNode;
  requerido?: boolean;
  className?: string;
}

type PropsEntrada<T extends FieldValues> = PropsBase<T> &
  Omit<ComponentProps<'input'>, 'name' | 'value' | 'onChange' | 'onBlur' | 'ref'>;

/** Puente React Hook Form → `Campo` + `Entrada`: el error y los atributos `aria-*` los resuelve `Campo`. */
export function CampoControlado<T extends FieldValues>({
  control,
  nombre,
  etiqueta,
  ayuda,
  requerido,
  className,
  ...entrada
}: PropsEntrada<T>) {
  return (
    <Controller
      control={control}
      name={nombre}
      render={({ field, fieldState }) => (
        <Campo
          etiqueta={etiqueta}
          ayuda={ayuda}
          requerido={requerido}
          error={fieldState.error?.message}
          className={className}
        >
          <Entrada
            {...entrada}
            name={field.name}
            ref={field.ref}
            value={(field.value as string | undefined) ?? ''}
            onChange={field.onChange}
            onBlur={field.onBlur}
          />
        </Campo>
      )}
    />
  );
}

export function SelectorControlado<T extends FieldValues>({
  control,
  nombre,
  etiqueta,
  ayuda,
  requerido,
  className,
  opciones,
  placeholder,
}: PropsBase<T> & { opciones: ReadonlyArray<OpcionSelector>; placeholder?: string }) {
  return (
    <Controller
      control={control}
      name={nombre}
      render={({ field, fieldState }) => (
        <Campo
          etiqueta={etiqueta}
          ayuda={ayuda}
          requerido={requerido}
          error={fieldState.error?.message}
          className={className}
        >
          <Selector
            opciones={opciones}
            valor={(field.value as string | undefined) || undefined}
            onCambio={field.onChange}
            placeholder={placeholder}
          />
        </Campo>
      )}
    />
  );
}

/** Área de texto con el mismo puente a React Hook Form. */
export function AreaControlada<T extends FieldValues>({
  control,
  nombre,
  etiqueta,
  ayuda,
  requerido,
  className,
  rows,
}: PropsBase<T> & { rows?: number }) {
  return (
    <Controller
      control={control}
      name={nombre}
      render={({ field, fieldState }) => (
        <Campo
          etiqueta={etiqueta}
          ayuda={ayuda}
          requerido={requerido}
          error={fieldState.error?.message}
          className={className}
        >
          <AreaTexto
            name={field.name}
            ref={field.ref}
            rows={rows}
            value={(field.value as string | undefined) ?? ''}
            onChange={field.onChange}
            onBlur={field.onBlur}
          />
        </Campo>
      )}
    />
  );
}
