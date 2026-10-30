'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm, useWatch, type Control } from 'react-hook-form';
import { mensajeDe } from '@/shared/api/errores';
import { aplicarError } from '@/shared/lib/errores-formulario';
import { AvisoAlerta } from '@/shared/ui/AvisoAlerta';
import { Boton } from '@/shared/ui/Boton';
import { AreaControlada, CampoControlado } from '@/shared/ui/CampoControlado';
import { GrupoRadio } from '@/shared/ui/GrupoRadio';
import { useCrearMascota, useEditarMascota } from '../hooks/useMascotasGestion';
import { RUTA_MASCOTAS } from '../lib/consulta';
import {
  CAMPOS_MASCOTA,
  campoDeFormulario,
  esConflicto,
  esFundacionNoAprobada,
} from '../lib/errores';
import {
  LIMITES,
  VALORES_INICIALES,
  aDatosMascota,
  cambiosMascota,
  esquemaMascota,
  valoresDesdeMascota,
  type ValoresMascota,
} from '../schemas/mascota';
import type { MascotaGestionDetalle } from '../types';
import { AvisoFundacionNoAprobada } from '@/shared/ui/AvisoFundacionNoAprobada';
import { CampoEdad } from './CampoEdad';
import { SelectorEspecieRaza } from './SelectorEspecieRaza';

const OPCIONES_SEXO = [
  { valor: 'macho', texto: 'Macho' },
  { valor: 'hembra', texto: 'Hembra' },
];
const OPCIONES_TAMANO = [
  { valor: 'pequeño', texto: 'Pequeño' },
  { valor: 'mediano', texto: 'Mediano' },
  { valor: 'grande', texto: 'Grande' },
];

type Props =
  | { modo: 'crear' }
  | {
      modo: 'editar';
      mascota: MascotaGestionDetalle;
      especieId: number | null;
      /** La ficha muestra el 409 (la mascota cambió de estado) aunque este formulario deje de montarse. */
      alConflicto: (mensaje: string) => void;
    };

function CasillaControlada({
  control,
  nombre,
  etiqueta,
}: {
  control: Control<ValoresMascota>;
  nombre: 'esterilizado' | 'vacunado';
  etiqueta: string;
}) {
  return (
    <Controller
      control={control}
      name={nombre}
      render={({ field }) => (
        <label className="flex min-h-11 items-center gap-3 text-base">
          <input
            type="checkbox"
            className="size-5"
            name={field.name}
            ref={field.ref}
            checked={field.value}
            onChange={(e) => field.onChange(e.target.checked)}
            onBlur={field.onBlur}
          />
          {etiqueta}
        </label>
      )}
    />
  );
}

/** Publicar (`crear`) o editar parcialmente (`editar`) una mascota; los errores del servidor van junto a su campo. */
export function FormularioMascota(props: Props) {
  const router = useRouter();
  const editando = props.modo === 'editar';
  const original = props.modo === 'editar' ? props.mascota : null;
  const crear = useCrearMascota();
  const editar = useEditarMascota(original?.id ?? 0);
  const [fallo, setFallo] = useState<string | null>(null);
  const [noAprobada, setNoAprobada] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const { control, handleSubmit, setError, setValue } = useForm<ValoresMascota>({
    resolver: zodResolver(esquemaMascota),
    mode: 'onTouched',
    shouldFocusError: true,
    defaultValues:
      props.modo === 'editar'
        ? valoresDesdeMascota(props.mascota, props.especieId)
        : VALORES_INICIALES,
  });
  const especieId = useWatch({ control, name: 'especieId' }) ?? '';
  const descripcion = useWatch({ control, name: 'descripcion' }) ?? '';
  const pendiente = crear.isPending || editar.isPending;

  function alFallar(error: unknown) {
    if (esFundacionNoAprobada(error)) {
      setNoAprobada(mensajeDe(error));
      return;
    }
    if (props.modo === 'editar' && esConflicto(error)) {
      props.alConflicto(`${mensajeDe(error)} Actualizamos la ficha con el estado real.`);
      return;
    }
    aplicarError(error, CAMPOS_MASCOTA, {
      marcarCampo: (campo, texto, enfocar) =>
        setError(
          campoDeFormulario(campo) as keyof ValoresMascota,
          { message: texto },
          { shouldFocus: enfocar },
        ),
      mostrarAviso: setFallo,
    });
  }

  function enviar(valores: ValoresMascota) {
    if (pendiente) return; // evita el doble envío
    setFallo(null);
    setMensaje(null);
    if (original) {
      const cambios = cambiosMascota(valores, original);
      if (Object.keys(cambios).length === 0) {
        setMensaje('No hiciste cambios en los datos.');
        return;
      }
      editar.mutate(cambios, {
        onSuccess: () => setMensaje('Guardamos los cambios de la mascota.'),
        onError: alFallar,
      });
      return;
    }
    crear.mutate(aDatosMascota(valores), {
      onSuccess: (mascota) =>
        router.push(`${RUTA_MASCOTAS}/${mascota.id}?pestana=fotos&publicada=1`),
      onError: alFallar,
    });
  }

  if (noAprobada !== null) return <AvisoFundacionNoAprobada mensajeServidor={noAprobada} />;

  return (
    <form noValidate onSubmit={handleSubmit(enviar)} className="flex max-w-2xl flex-col gap-5">
      <p className="text-muted-foreground text-sm">Los campos con * son obligatorios.</p>
      {fallo && <AvisoAlerta>{fallo}</AvisoAlerta>}
      {mensaje && (
        <p role="status" className="border-success bg-card rounded-md border-2 p-3">
          {mensaje}
        </p>
      )}
      <CampoControlado
        control={control}
        nombre="nombre"
        etiqueta="Nombre"
        requerido
        autoComplete="off"
      />
      <SelectorEspecieRaza control={control} setValue={setValue} especieId={especieId} />
      <GrupoRadio
        control={control}
        nombre="sexo"
        leyenda="Sexo"
        opciones={OPCIONES_SEXO}
        requerido
      />
      <CampoEdad control={control} />
      <GrupoRadio
        control={control}
        nombre="tamano"
        leyenda="Tamaño"
        opciones={OPCIONES_TAMANO}
        requerido
      />
      <CampoControlado
        control={control}
        nombre="color"
        etiqueta="Color (opcional)"
        autoComplete="off"
      />
      <CampoControlado
        control={control}
        nombre="estadoSalud"
        etiqueta="Estado de salud"
        ayuda="Por ejemplo: «Sano y desparasitado»."
        requerido
        autoComplete="off"
      />
      <AreaControlada
        control={control}
        nombre="descripcion"
        etiqueta="Descripción (opcional)"
        ayuda={`${descripcion.length} de ${LIMITES.descripcion} caracteres`}
        rows={5}
      />
      <fieldset className="flex flex-col gap-1">
        <legend className="text-base font-semibold">Cuidados</legend>
        <CasillaControlada control={control} nombre="esterilizado" etiqueta="Está esterilizado/a" />
        <CasillaControlada
          control={control}
          nombre="vacunado"
          etiqueta="Tiene las vacunas al día"
        />
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <Boton type="submit" cargando={pendiente}>
          {editando ? 'Guardar cambios' : 'Publicar mascota'}
        </Boton>
        {!editando && (
          <Boton comoHijo variante="contorno">
            <Link href={RUTA_MASCOTAS}>Cancelar</Link>
          </Boton>
        )}
      </div>
    </form>
  );
}
