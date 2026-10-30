'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState, type ComponentProps } from 'react';
import { Controller, useWatch, type Control, type FieldValues, type Path } from 'react-hook-form';
import { Campo, Entrada } from '@/shared/ui/Campo';
import { IndicadorFortaleza } from './IndicadorFortaleza';

/** Entrada con botón «Mostrar/Ocultar»; recibe de `Campo` el id y los atributos `aria-*`. */
function EntradaContrasena(props: ComponentProps<'input'>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex items-stretch gap-2">
      <Entrada {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        className="border-border bg-card hover:bg-muted inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border px-3 text-base font-semibold"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
        {visible ? 'Ocultar' : 'Mostrar'}
      </button>
    </div>
  );
}

function Fortaleza<T extends FieldValues>({
  control,
  nombre,
}: {
  control: Control<T>;
  nombre: Path<T>;
}) {
  const valor = useWatch({ control, name: nombre }) as string | undefined;
  return <IndicadorFortaleza contrasena={valor ?? ''} />;
}

export function CampoContrasena<T extends FieldValues>({
  control,
  nombre,
  etiqueta = 'Contraseña',
  autoComplete = 'new-password',
  conFortaleza = false,
  ayuda,
}: {
  control: Control<T>;
  nombre: Path<T>;
  etiqueta?: string;
  autoComplete?: 'new-password' | 'current-password';
  conFortaleza?: boolean;
  ayuda?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Controller
        control={control}
        name={nombre}
        render={({ field, fieldState }) => (
          <Campo etiqueta={etiqueta} requerido error={fieldState.error?.message} ayuda={ayuda}>
            <EntradaContrasena
              name={field.name}
              ref={field.ref}
              value={(field.value as string | undefined) ?? ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              autoComplete={autoComplete}
            />
          </Campo>
        )}
      />
      {conFortaleza && <Fortaleza control={control} nombre={nombre} />}
    </div>
  );
}
