'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { esErrorApi } from '@/shared/api/errores';
import { aplicarError } from '@/shared/lib/errores-formulario';
import { hoyEnBogota } from '@/shared/lib/fechas';
import { AvisoAlerta } from '@/shared/ui/AvisoAlerta';
import { Boton } from '@/shared/ui/Boton';
import { AreaControlada, CampoControlado } from '@/shared/ui/CampoControlado';
import { CampoFotos } from '@/shared/ui/CampoFotos';
import { GrupoRadio } from '@/shared/ui/GrupoRadio';
import { useRegistrarResultado } from '../hooks/useAdopcionesGestion';
import { campoDelMensaje } from '../lib/errores';
import { MAX_EVIDENCIAS, MAX_OBSERVACIONES, crearEsquemaResultado } from '../schemas/resultado';
import {
  ESTADOS_BIENESTAR,
  ETIQUETA_BIENESTAR,
  type DetalleSeguimientoFundacion,
  type EstadoBienestar,
} from '../types';

interface Valores {
  fechaRealizada?: string;
  estadoBienestar?: EstadoBienestar;
  observaciones?: string;
  evidencias?: File[];
}

const CAMPOS = ['fechaRealizada', 'estadoBienestar', 'observaciones', 'evidencias'] as const;
const OPCIONES = ESTADOS_BIENESTAR.map((e) => ({ valor: e, texto: ETIQUETA_BIENESTAR[e] }));

/** Registro del resultado de un seguimiento pendiente: fecha, bienestar, observaciones y evidencias. */
export function FormularioResultado({
  seguimiento: s,
  alRegistrado,
  alAviso,
}: {
  seguimiento: DetalleSeguimientoFundacion;
  alRegistrado: (detalle: DetalleSeguimientoFundacion) => void;
  alAviso: (mensaje: string) => void;
}) {
  const [fallo, setFallo] = useState<string | null>(null);
  const registrar = useRegistrarResultado(s.id);
  // «Hoy» se calcula al validar: la pantalla puede quedar abierta pasada la medianoche.
  const resolver = useMemo<Resolver<Valores>>(
    () => (valores, contexto, opciones) =>
      (
        zodResolver(
          crearEsquemaResultado(s.fechaEntrega, hoyEnBogota()),
        ) as unknown as Resolver<Valores>
      )(valores, contexto, opciones),
    [s.fechaEntrega],
  );
  const { control, handleSubmit, setError } = useForm<Valores>({
    resolver,
    mode: 'onTouched',
    shouldFocusError: true,
    defaultValues: { observaciones: '', evidencias: [] },
  });
  const observaciones = useWatch({ control, name: 'observaciones' }) ?? '';

  async function enviar(datos: Valores) {
    if (registrar.isPending) return;
    setFallo(null);
    try {
      const detalle = await registrar.mutateAsync({
        fechaRealizada: datos.fechaRealizada as string,
        estadoBienestar: datos.estadoBienestar as EstadoBienestar,
        observaciones: (datos.observaciones ?? '').trim(),
        evidencias: datos.evidencias ?? [],
      });
      alRegistrado(detalle);
    } catch (error) {
      // 409: otro usuario lo registró o el reporte aún no existe; la pantalla relee y lo explica.
      if (esErrorApi(error) && error.estado === 409) return alAviso(error.mensaje);
      aplicarError(
        error,
        CAMPOS,
        {
          marcarCampo: (campo, mensaje, enfocar) =>
            setError(campo as keyof Valores, { message: mensaje }, { shouldFocus: enfocar }),
          mostrarAviso: setFallo,
        },
        campoDelMensaje,
      );
    }
  }

  return (
    <section aria-labelledby="titulo-resultado" className="flex flex-col gap-4">
      <h2 id="titulo-resultado" className="text-2xl">
        Registrar el resultado
      </h2>
      <form
        noValidate
        onSubmit={handleSubmit(enviar)}
        aria-busy={registrar.isPending || undefined}
        className="border-border-suave bg-card flex flex-col gap-5 rounded-lg border p-4"
      >
        {fallo && <AvisoAlerta>{fallo}</AvisoAlerta>}
        <CampoControlado
          control={control}
          nombre="fechaRealizada"
          etiqueta="Fecha en que se realizó"
          ayuda="Entre la fecha de entrega y hoy."
          type="date"
          min={s.fechaEntrega}
          max={hoyEnBogota()}
          requerido
        />
        <GrupoRadio
          control={control}
          nombre="estadoBienestar"
          leyenda="Estado de bienestar de la mascota"
          opciones={OPCIONES}
          requerido
        />
        <AreaControlada
          control={control}
          nombre="observaciones"
          etiqueta="Observaciones"
          ayuda={`${observaciones.length} de ${MAX_OBSERVACIONES} caracteres`}
          rows={5}
          requerido
        />
        <CampoFotos
          control={control}
          nombre="evidencias"
          etiqueta="Evidencias (opcional)"
          ayuda={`JPG o PNG, máximo 5 MB cada una, hasta ${MAX_EVIDENCIAS} fotos.`}
          maximo={MAX_EVIDENCIAS}
        />
        <Boton type="submit" cargando={registrar.isPending} className="w-full self-start sm:w-auto">
          Registrar resultado
        </Boton>
      </form>
    </section>
  );
}
