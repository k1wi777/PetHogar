'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useRef, useState } from 'react';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { esErrorApi } from '@/shared/api/errores';
import { aplicarError } from '@/shared/lib/errores-formulario';
import { AvisoAlerta } from '@/shared/ui/AvisoAlerta';
import { Boton } from '@/shared/ui/Boton';
import { AreaControlada } from '@/shared/ui/CampoControlado';
import { DialogoConfirmacion } from '@/shared/ui/DialogoConfirmacion';
import { useDecidirValidacion } from '../hooks/useAdminFundaciones';
import { decisionesPosibles } from '../lib/estado';
import { MAX_OBSERVACION, esquemaValidacion } from '../schemas/decision';
import type { DatosValidacion, DecisionValidacion, DetalleFundacion } from '../types';

interface Valores {
  observacion?: string;
}

/** Palabras del servidor que delatan que un 4xx es de la observación. */
function campoDelMensaje(mensaje: string): string | null {
  const texto = mensaje.toLowerCase();
  return texto.includes('observación') || texto.includes('motivo') ? 'observacion' : null;
}

/**
 * Panel «Tu decisión»: solo ofrece lo que el estado vigente permite, valida la observación
 * (obligatoria al rechazar), pide confirmación y envía la decisión (pesimista).
 */
export function PanelValidacion({
  fundacion,
  alDecidir,
  alAviso,
  alNoEncontrada,
}: {
  fundacion: DetalleFundacion;
  alDecidir: (detalle: DetalleFundacion) => void;
  alAviso: (mensaje: string) => void;
  alNoEncontrada: () => void;
}) {
  const decisiones = decisionesPosibles(fundacion.estadoValidacion);
  const [pendiente, setPendiente] = useState<DatosValidacion | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const decidir = useDecidirValidacion(fundacion.id);
  // El botón pulsado fija la decisión; el esquema decide qué observación exige.
  const eleccion = useRef<DecisionValidacion>('aprobada');
  const resolver = useMemo<Resolver<Valores>>(
    () => (valores, contexto, opciones) =>
      (zodResolver(esquemaValidacion) as unknown as Resolver<Valores>)(
        { ...valores, decision: eleccion.current } as Valores,
        contexto,
        opciones,
      ),
    [],
  );
  const { control, handleSubmit, setError } = useForm<Valores>({
    resolver,
    mode: 'onSubmit',
    shouldFocusError: true,
    defaultValues: { observacion: '' },
  });
  const observacion = useWatch({ control, name: 'observacion' }) ?? '';

  function elegir(decision: DecisionValidacion) {
    eleccion.current = decision;
    void handleSubmit((datos) => setPendiente(datos as unknown as DatosValidacion))();
  }

  async function confirmar() {
    if (!pendiente) return;
    setFallo(null);
    try {
      const detalle = await decidir.decidir(pendiente);
      if (!detalle) return;
      setPendiente(null);
      alDecidir(detalle);
    } catch (error) {
      setPendiente(null);
      if (esErrorApi(error) && error.estado === 404) return alNoEncontrada();
      if (esErrorApi(error) && error.estado === 409) {
        return alAviso(`${error.mensaje}. Mostramos el estado actual de la fundación.`);
      }
      aplicarError(
        error,
        ['observacion'],
        {
          marcarCampo: (campo, mensaje, enfocar) =>
            setError(campo as keyof Valores, { message: mensaje }, { shouldFocus: enfocar }),
          mostrarAviso: setFallo,
        },
        campoDelMensaje,
      );
    }
  }

  if (decisiones.length === 0) return null;

  const aprobando = pendiente?.decision === 'aprobada';
  const nombre = fundacion.nombre;

  return (
    <section aria-labelledby="titulo-validacion" className="flex flex-col gap-4">
      <h2 id="titulo-validacion" className="text-2xl">
        Tu decisión
      </h2>
      <form
        noValidate
        onSubmit={(e) => e.preventDefault()}
        className="border-border-suave bg-card flex flex-col gap-4 rounded-lg border p-4"
      >
        {fallo && <AvisoAlerta>{fallo}</AvisoAlerta>}
        <AreaControlada
          control={control}
          nombre="observacion"
          etiqueta="Observación"
          ayuda={`Obligatoria al rechazar: la fundación la recibirá. Opcional al aprobar. ${observacion.length} de ${MAX_OBSERVACION} caracteres.`}
          rows={4}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          {decisiones.includes('aprobada') && (
            <Boton onClick={() => elegir('aprobada')} className="w-full sm:w-auto">
              Aprobar
            </Boton>
          )}
          {decisiones.includes('rechazada') && (
            <Boton
              variante="destructivo"
              onClick={() => elegir('rechazada')}
              className="w-full sm:w-auto"
            >
              Rechazar
            </Boton>
          )}
        </div>
      </form>

      <DialogoConfirmacion
        abierto={pendiente !== null}
        onAbiertoChange={(a) => !a && !decidir.isPending && setPendiente(null)}
        titulo={aprobando ? `¿Aprobar a ${nombre}?` : `¿Rechazar a ${nombre}?`}
        descripcion={
          pendiente ? (
            aprobando ? (
              <>
                <span className="block">
                  La fundación podrá entrar a su panel completo en su siguiente inicio de sesión y
                  le avisaremos por correo.
                </span>
                {pendiente.observacion && (
                  <span className="mt-2 block">Observación: {pendiente.observacion}</span>
                )}
              </>
            ) : (
              <>
                <span className="block">
                  La fundación recibirá este motivo por correo: {pendiente.observacion}
                </span>
                <span className="mt-2 block">
                  Podrás aprobarla más adelante si corrige sus datos.
                </span>
              </>
            )
          ) : (
            ''
          )
        }
        textoConfirmar={aprobando ? 'Sí, aprobar' : 'Sí, rechazar'}
        textoCancelar="Volver"
        destructivo={pendiente?.decision === 'rechazada'}
        cargando={decidir.isPending}
        onConfirmar={() => void confirmar()}
      />
    </section>
  );
}
