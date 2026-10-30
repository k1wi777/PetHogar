'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { aplicarError } from '@/shared/lib/errores-formulario';
import { AvisoAlerta } from '@/shared/ui/AvisoAlerta';
import { Boton } from '@/shared/ui/Boton';
import { AreaControlada } from '@/shared/ui/CampoControlado';
import { DialogoConfirmacion } from '@/shared/ui/DialogoConfirmacion';
import { GrupoRadio } from '@/shared/ui/GrupoRadio';
import { useCerrarAdopcion } from '../hooks/useAdopcionesGestion';
import { AVISO_SIN_ACTA, consecuenciasDelCierre } from '../lib/cierre';
import {
  campoDelMensajeCierre,
  esAdopcionCerrada,
  esAdopcionInexistente,
  esFundacionNoAprobada,
} from '../lib/errores';
import { MAX_MOTIVO_CIERRE, esquemaCierre } from '../schemas/cierre';
import type { AdopcionFundacion, DatosCierre } from '../types';

interface Valores {
  estado?: 'finalizada' | 'revocada';
  mascotaDestino?: 'disponible' | 'inactiva';
  motivo?: string;
}

const CAMPOS = ['estado', 'mascotaDestino', 'motivo'] as const;
const OPCIONES_ESTADO = [
  { valor: 'finalizada', texto: 'Finalizar la adopción (todo salió bien)' },
  { valor: 'revocada', texto: 'Revocar la adopción (la mascota regresa a la fundación)' },
];
const OPCIONES_DESTINO = [
  { valor: 'disponible', texto: 'Vuelve a estar disponible' },
  { valor: 'inactiva', texto: 'Queda inactiva' },
];

/** Panel de «Cerrar adopción»: valida, pide confirmación con las consecuencias y envía el cierre. */
export function PanelCerrarAdopcion({
  id,
  adopcion,
  alCerrada,
  alAviso,
  alCancelar,
}: {
  id: string;
  adopcion: AdopcionFundacion;
  alCerrada: (cierre: DatosCierre, cerrada: AdopcionFundacion) => void;
  /** Avisos que dejan de depender de este panel (409, 404, 403): la lista se vuelve a leer. */
  alAviso: (mensaje: string) => void;
  alCancelar: () => void;
}) {
  const [pendiente, setPendiente] = useState<DatosCierre | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const cerrar = useCerrarAdopcion(adopcion.id);
  const { control, handleSubmit, setError, setFocus } = useForm<Valores>({
    resolver: zodResolver(esquemaCierre) as unknown as Resolver<Valores>,
    mode: 'onTouched',
    shouldFocusError: true,
    // El destino solo vale al revocar: al finalizar se descarta (ni se valida ni se envía).
    shouldUnregister: true,
    defaultValues: {},
  });
  useEffect(() => setFocus('estado'), [setFocus]);
  const estado = useWatch({ control, name: 'estado' });
  const motivo = useWatch({ control, name: 'motivo' }) ?? '';
  const nombre = adopcion.mascota.nombre;

  async function confirmar() {
    if (!pendiente) return;
    setFallo(null);
    try {
      const cerrada = await cerrar.mutateAsync(pendiente);
      const datos = pendiente;
      setPendiente(null);
      alCerrada(datos, cerrada);
    } catch (error) {
      setPendiente(null);
      if (esAdopcionCerrada(error)) {
        return alAviso(`Esta adopción ya fue cerrada. Mostramos su estado actual.`);
      }
      if (esAdopcionInexistente(error)) return alAviso('La adopción ya no existe.');
      if (esFundacionNoAprobada(error)) return; // La lista vuelve a pedirse y muestra el aviso de validación.
      aplicarError(
        error,
        CAMPOS,
        {
          marcarCampo: (campo, mensaje, enfocar) =>
            setError(campo as keyof Valores, { message: mensaje }, { shouldFocus: enfocar }),
          mostrarAviso: setFallo,
        },
        campoDelMensajeCierre,
      );
    }
  }

  return (
    <>
      <form
        id={id}
        noValidate
        onSubmit={handleSubmit((d) => setPendiente(d as unknown as DatosCierre))}
        className="border-border-suave bg-card flex flex-col gap-4 rounded-md border p-4"
        aria-label={`Cerrar la adopción de ${nombre}`}
      >
        {fallo && <AvisoAlerta>{fallo}</AvisoAlerta>}
        <GrupoRadio
          control={control}
          nombre="estado"
          leyenda="¿Cómo cierras la adopción?"
          opciones={OPCIONES_ESTADO}
          requerido
        />
        {estado === 'revocada' && (
          <GrupoRadio
            control={control}
            nombre="mascotaDestino"
            leyenda={`¿Qué pasa con ${nombre}?`}
            opciones={OPCIONES_DESTINO}
            ayuda="Elige si vuelve a publicarse para adopción o si la fundación la deja inactiva."
            requerido
          />
        )}
        <AreaControlada
          control={control}
          nombre="motivo"
          etiqueta="Motivo del cierre"
          ayuda={`Queda registrado y se muestra en la adopción. ${motivo.length} de ${MAX_MOTIVO_CIERRE} caracteres.`}
          rows={4}
          requerido
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Boton type="submit" className="w-full sm:w-auto">
            Continuar
          </Boton>
          <Boton variante="contorno" onClick={alCancelar} className="w-full sm:w-auto">
            Cancelar
          </Boton>
        </div>
      </form>

      <DialogoConfirmacion
        abierto={pendiente !== null}
        onAbiertoChange={(a) => !a && !cerrar.isPending && setPendiente(null)}
        titulo={
          pendiente?.estado === 'revocada'
            ? `¿Revocar la adopción de ${nombre}?`
            : `¿Finalizar la adopción de ${nombre}?`
        }
        descripcion={
          pendiente ? (
            <>
              {consecuenciasDelCierre(pendiente, nombre).map((c) => (
                <span key={c} className="text-foreground mt-1 block first:mt-0">
                  • {c}
                </span>
              ))}
              {adopcion.acta === null && (
                <strong className="text-foreground mt-3 block">{AVISO_SIN_ACTA}</strong>
              )}
              <span className="mt-3 block break-words">Motivo: {pendiente.motivo}</span>
            </>
          ) : (
            ''
          )
        }
        textoConfirmar={
          pendiente?.estado === 'revocada' ? 'Sí, revocar la adopción' : 'Sí, finalizar la adopción'
        }
        textoCancelar="Volver"
        destructivo
        cargando={cerrar.isPending}
        onConfirmar={() => void confirmar()}
      />
    </>
  );
}
