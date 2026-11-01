'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { mensajeDe } from '@/shared/lib/errores-usuario';
import { aplicarError } from '@/shared/lib/errores-formulario';
import { etiquetaTipoHistorial } from '@/shared/lib/formato-mascota';
import { AvisoAlerta } from '@/shared/ui/AvisoAlerta';
import { Boton } from '@/shared/ui/Boton';
import { AreaControlada, CampoControlado, SelectorControlado } from '@/shared/ui/CampoControlado';
import { useRegistrarEvento } from '../hooks/useMascotasGestion';
import { CAMPOS_HISTORIAL, esFundacionNoAprobada } from '../lib/errores';
import {
  MAX_DESCRIPCION,
  TIPOS_HISTORIAL,
  aDatosHistorial,
  esquemaHistorial,
  hoyBogota,
  type ValoresHistorial,
} from '../schemas/historial';

const OPCIONES_TIPO = TIPOS_HISTORIAL.map((t) => ({ valor: t, texto: etiquetaTipoHistorial(t) }));
const VALORES_VACIOS = { tipo: '', fecha: '', descripcion: '', veterinario: '' };

/** Nuevo registro médico. Un error del servidor (p. ej. fecha futura) queda junto al campo y conserva lo escrito. */
export function FormularioHistorial({
  mascotaId,
  publicado,
  alNoAprobada,
}: {
  mascotaId: number;
  /** La mascota está disponible: el registro se ve también en la ficha pública. */
  publicado: boolean;
  alNoAprobada: (mensaje: string) => void;
}) {
  const registrar = useRegistrarEvento(mascotaId);
  const [fallo, setFallo] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const { control, handleSubmit, setError, reset } = useForm<ValoresHistorial>({
    resolver: zodResolver(esquemaHistorial),
    mode: 'onTouched',
    shouldFocusError: true,
    defaultValues: VALORES_VACIOS,
  });
  const descripcion = useWatch({ control, name: 'descripcion' }) ?? '';

  function enviar(valores: ValoresHistorial) {
    if (registrar.isPending) return;
    setFallo(null);
    setMensaje(null);
    registrar.mutate(aDatosHistorial(valores), {
      onSuccess: () => {
        reset(VALORES_VACIOS);
        setMensaje(
          publicado
            ? 'Registramos el evento. Ya aparece en la ficha pública de la mascota.'
            : 'Registramos el evento.',
        );
      },
      onError: (error) => {
        if (esFundacionNoAprobada(error)) return alNoAprobada(mensajeDe(error));
        aplicarError(error, CAMPOS_HISTORIAL, {
          marcarCampo: (campo, texto, enfocar) =>
            setError(campo as keyof ValoresHistorial, { message: texto }, { shouldFocus: enfocar }),
          mostrarAviso: setFallo,
        });
      },
    });
  }

  return (
    <form noValidate onSubmit={handleSubmit(enviar)} className="flex max-w-2xl flex-col gap-5">
      <h3 className="text-xl">Registrar un evento</h3>
      <p className="text-muted-foreground text-sm">Los campos con * son obligatorios.</p>
      {fallo && <AvisoAlerta>{fallo}</AvisoAlerta>}
      {mensaje && (
        <p role="status" className="border-success bg-card rounded-md border-2 p-3">
          {mensaje}
        </p>
      )}
      <SelectorControlado
        control={control}
        nombre="tipo"
        etiqueta="Tipo de evento"
        opciones={OPCIONES_TIPO}
        placeholder="Elige el tipo"
        requerido
      />
      <CampoControlado
        control={control}
        nombre="fecha"
        etiqueta="Fecha"
        type="date"
        max={hoyBogota()}
        ayuda="No puede ser posterior a hoy."
        requerido
      />
      <AreaControlada
        control={control}
        nombre="descripcion"
        etiqueta="Descripción"
        ayuda={`${descripcion.length} de ${MAX_DESCRIPCION} caracteres`}
        rows={4}
        requerido
      />
      <CampoControlado
        control={control}
        nombre="veterinario"
        etiqueta="Veterinario (opcional)"
        autoComplete="off"
      />
      <div>
        <Boton type="submit" cargando={registrar.isPending}>
          Registrar evento
        </Boton>
      </div>
    </form>
  );
}
