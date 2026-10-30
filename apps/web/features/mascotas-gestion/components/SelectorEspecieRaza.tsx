'use client';

import { Controller, type Control, type UseFormSetValue } from 'react-hook-form';
import { Campo } from '@/shared/ui/Campo';
import { EstadoError } from '@/shared/ui/EstadoError';
import { Selector } from '@/shared/ui/Selector';
import { useEspecies, useRazas } from '../hooks/useMascotasGestion';
import type { ValoresMascota } from '../schemas/mascota';

const SIN_ESPECIE = 'Primero elige la especie.';

/** Especie y raza dependientes: al cambiar la especie se ofrecen solo sus razas y se limpia la raza previa. */
export function SelectorEspecieRaza({
  control,
  setValue,
  especieId,
}: {
  control: Control<ValoresMascota>;
  setValue: UseFormSetValue<ValoresMascota>;
  /** Especie elegida (texto del formulario; vacío si aún no hay). */
  especieId: string;
}) {
  const especies = useEspecies();
  const id = especieId ? Number(especieId) : null;
  const razas = useRazas(id);

  if (especies.isError) {
    return (
      <EstadoError
        titulo="No pudimos cargar las especies"
        alReintentar={() => void especies.refetch()}
        reintentando={especies.isFetching}
      />
    );
  }

  return (
    <>
      <Controller
        control={control}
        name="especieId"
        render={({ field, fieldState }) => (
          <Campo etiqueta="Especie" requerido error={fieldState.error?.message}>
            <Selector
              opciones={(especies.data ?? []).map((e) => ({
                valor: String(e.id),
                texto: e.nombre.charAt(0).toUpperCase() + e.nombre.slice(1),
              }))}
              valor={field.value ?? ''}
              onCambio={(valor) => {
                if (valor === field.value) return;
                field.onChange(valor);
                setValue('razaId', '', { shouldDirty: true, shouldValidate: false });
              }}
              placeholder={especies.isPending ? 'Cargando…' : 'Elige la especie'}
              disabled={especies.isPending}
            />
          </Campo>
        )}
      />
      <Controller
        control={control}
        name="razaId"
        render={({ field, fieldState }) => (
          <Campo
            etiqueta="Raza"
            requerido
            error={fieldState.error?.message}
            ayuda={
              id === null ? SIN_ESPECIE : razas.isError ? 'No pudimos cargar las razas.' : undefined
            }
          >
            <Selector
              opciones={(razas.data ?? []).map((r) => ({ valor: String(r.id), texto: r.nombre }))}
              valor={field.value ?? ''}
              onCambio={field.onChange}
              placeholder={
                id === null
                  ? 'Primero elige la especie'
                  : razas.isPending
                    ? 'Cargando…'
                    : 'Elige la raza'
              }
              disabled={id === null || razas.isPending || razas.isError}
            />
          </Campo>
        )}
      />
      {razas.isError && (
        <div>
          <button
            type="button"
            className="text-primary min-h-11 font-semibold underline"
            onClick={() => void razas.refetch()}
          >
            Reintentar cargar las razas
          </button>
        </div>
      )}
    </>
  );
}
