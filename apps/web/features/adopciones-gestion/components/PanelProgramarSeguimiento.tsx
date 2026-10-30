'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { hoyEnBogota, sumarDias } from '@/shared/lib/fechas';
import { aplicarError } from '@/shared/lib/errores-formulario';
import { AvisoAlerta } from '@/shared/ui/AvisoAlerta';
import { Boton } from '@/shared/ui/Boton';
import { CampoControlado } from '@/shared/ui/CampoControlado';
import { GrupoRadio } from '@/shared/ui/GrupoRadio';
import { useProgramarSeguimiento } from '../hooks/useAdopcionesGestion';
import { campoDelMensaje } from '../lib/errores';
import { crearEsquemaProgramar } from '../schemas/programar';
import type { AdopcionFundacion, DetalleSeguimientoFundacion, TipoSeguimiento } from '../types';

interface Valores {
  tipo?: TipoSeguimiento;
  fechaProgramada?: string;
}

const CAMPOS = ['tipo', 'fechaProgramada'] as const;
const OPCIONES = [
  { valor: 'visita', texto: 'Visita (la fundación visita al adoptante)' },
  { valor: 'reporte', texto: 'Reporte (el adoptante envía fotos y comentarios)' },
];

/** Panel desplegable de «Programar seguimiento» de una adopción activa. */
export function PanelProgramarSeguimiento({
  id,
  adopcion,
  alProgramado,
  alCancelar,
}: {
  id: string;
  adopcion: AdopcionFundacion;
  alProgramado: (seguimiento: DetalleSeguimientoFundacion) => void;
  alCancelar: () => void;
}) {
  const [fallo, setFallo] = useState<string | null>(null);
  const programar = useProgramarSeguimiento(adopcion.id);
  // «Hoy» se calcula al validar: la pantalla puede quedar abierta pasada la medianoche.
  const resolver = useMemo<Resolver<Valores>>(
    () => (valores, contexto, opciones) =>
      (
        zodResolver(
          crearEsquemaProgramar(adopcion.fechaEntrega, hoyEnBogota()),
        ) as unknown as Resolver<Valores>
      )(valores, contexto, opciones),
    [adopcion.fechaEntrega],
  );
  const { control, handleSubmit, setError, setFocus } = useForm<Valores>({
    resolver,
    mode: 'onTouched',
    shouldFocusError: true,
    defaultValues: {},
  });
  useEffect(() => setFocus('tipo'), [setFocus]);

  const hoy = hoyEnBogota();
  const minimo = [sumarDias(adopcion.fechaEntrega, 1), hoy].sort().at(-1);

  async function enviar(datos: Valores) {
    setFallo(null);
    try {
      const creado = await programar.mutateAsync({
        tipo: datos.tipo as TipoSeguimiento,
        fechaProgramada: datos.fechaProgramada as string,
      });
      alProgramado(creado);
    } catch (error) {
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
    <form
      id={id}
      noValidate
      onSubmit={handleSubmit((d) => (programar.isPending ? undefined : enviar(d)))}
      className="border-border-suave bg-card flex flex-col gap-4 rounded-md border p-4"
      aria-label={`Programar seguimiento de ${adopcion.mascota.nombre}`}
    >
      {fallo && <AvisoAlerta>{fallo}</AvisoAlerta>}
      <GrupoRadio
        control={control}
        nombre="tipo"
        leyenda="Tipo de seguimiento"
        opciones={OPCIONES}
        requerido
      />
      <CampoControlado
        control={control}
        nombre="fechaProgramada"
        etiqueta="Fecha límite del seguimiento"
        ayuda="Debe ser posterior a la entrega y no puede ser una fecha pasada."
        type="date"
        min={minimo}
        requerido
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Boton type="submit" cargando={programar.isPending} className="w-full sm:w-auto">
          Programar seguimiento
        </Boton>
        <Boton
          variante="contorno"
          onClick={alCancelar}
          disabled={programar.isPending}
          className="w-full sm:w-auto"
        >
          Cancelar
        </Boton>
      </div>
    </form>
  );
}
