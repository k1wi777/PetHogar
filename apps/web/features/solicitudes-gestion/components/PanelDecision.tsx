'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { esErrorApi } from '@/shared/api/errores';
import { hoyEnBogota } from '@/shared/lib/fechas';
import { aplicarError } from '@/shared/lib/errores-formulario';
import { AvisoAlerta } from '@/shared/ui/AvisoAlerta';
import { Boton } from '@/shared/ui/Boton';
import { AreaControlada, CampoControlado } from '@/shared/ui/CampoControlado';
import { DialogoConfirmacion } from '@/shared/ui/DialogoConfirmacion';
import { GrupoRadio } from '@/shared/ui/GrupoRadio';
import { formatearFecha } from '@/shared/lib/fechas';
import { useDecidirSolicitud, useOtrasPendientes } from '../hooks/useSolicitudesGestion';
import { campoDelMensaje } from '../lib/errores';
import { MAX_OBSERVACION, crearEsquemaDecision } from '../schemas/decision';
import type { DatosDecision, DetalleSolicitudRecibida } from '../types';

interface Valores {
  decision?: 'aprobar' | 'rechazar';
  fechaEntrega?: string;
  observacion?: string;
}

const CAMPOS = ['decision', 'fechaEntrega', 'observacion'] as const;
const OPCIONES = [
  { valor: 'aprobar', texto: 'Aprobar la solicitud' },
  { valor: 'rechazar', texto: 'Rechazar la solicitud' },
];

/** Panel «Tu decisión»: valida, pide confirmación y envía la decisión (irreversible). */
export function PanelDecision({
  solicitud,
  alDecidir,
  alAviso,
  alNoEncontrada,
}: {
  solicitud: DetalleSolicitudRecibida;
  alDecidir: (detalle: DetalleSolicitudRecibida) => void;
  alAviso: (mensaje: string) => void;
  alNoEncontrada: () => void;
}) {
  const [pendiente, setPendiente] = useState<DatosDecision | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const decidir = useDecidirSolicitud(solicitud.id);
  // El «hoy» del esquema se calcula en cada validación: la pantalla puede quedar abierta pasada la medianoche.
  const resolver = useMemo<Resolver<Valores>>(
    () => (valores, contexto, opciones) =>
      (zodResolver(crearEsquemaDecision(hoyEnBogota())) as unknown as Resolver<Valores>)(
        valores,
        contexto,
        opciones,
      ),
    [],
  );
  const { control, handleSubmit, setError } = useForm<Valores>({
    resolver,
    mode: 'onTouched',
    shouldFocusError: true,
    // El campo que no corresponde a la decisión se descarta: ni se valida ni se envía.
    shouldUnregister: true,
    defaultValues: {},
  });
  const eleccion = useWatch({ control, name: 'decision' });
  const observacion = useWatch({ control, name: 'observacion' }) ?? '';
  const otras = useOtrasPendientes(solicitud.mascota.id, pendiente?.decision === 'aprobar');

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
        return alAviso(`${error.mensaje}. Mostramos el estado actual de la solicitud.`);
      }
      if (esErrorApi(error) && error.estado === 403) return alAviso(error.mensaje);
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

  const nombre = solicitud.mascota.nombre;
  const aprobando = pendiente?.decision === 'aprobar';

  return (
    <section aria-labelledby="titulo-decision" className="flex flex-col gap-4">
      <h2 id="titulo-decision" className="text-2xl">
        Tu decisión
      </h2>
      <form
        noValidate
        onSubmit={handleSubmit((datos) => setPendiente(datos as unknown as DatosDecision))}
        className="border-border-suave bg-card flex flex-col gap-5 rounded-lg border p-4"
      >
        {fallo && <AvisoAlerta>{fallo}</AvisoAlerta>}
        <GrupoRadio
          control={control}
          nombre="decision"
          leyenda="¿Qué decides?"
          opciones={OPCIONES}
          requerido
        />
        {eleccion === 'aprobar' && (
          <CampoControlado
            control={control}
            nombre="fechaEntrega"
            etiqueta="Fecha de entrega"
            ayuda="El día en que entregarás la mascota al adoptante: hoy o una fecha posterior."
            type="date"
            min={hoyEnBogota()}
            requerido
          />
        )}
        {eleccion && (
          <AreaControlada
            control={control}
            nombre="observacion"
            etiqueta={eleccion === 'rechazar' ? 'Motivo del rechazo' : 'Observación (opcional)'}
            ayuda={
              eleccion === 'rechazar'
                ? `El adoptante recibirá este motivo. ${observacion.length} de ${MAX_OBSERVACION} caracteres.`
                : `${observacion.length} de ${MAX_OBSERVACION} caracteres.`
            }
            rows={4}
            requerido={eleccion === 'rechazar'}
          />
        )}
        <Boton type="submit" className="w-full self-start sm:w-auto">
          Continuar
        </Boton>
      </form>

      <DialogoConfirmacion
        abierto={pendiente !== null}
        onAbiertoChange={(a) => !a && !decidir.isPending && setPendiente(null)}
        titulo={aprobando ? `¿Aprobar la solicitud de ${nombre}?` : '¿Rechazar la solicitud?'}
        descripcion={
          pendiente?.decision === 'aprobar' ? (
            <>
              <strong className="text-foreground block">
                Al aprobar, las demás solicitudes pendientes de {nombre} se rechazarán
                automáticamente y no se puede deshacer.
              </strong>
              {otras.data !== undefined && otras.data > 0 && (
                <span className="mt-2 block">
                  Hay {otras.data} {otras.data === 1 ? 'solicitud más' : 'solicitudes más'}{' '}
                  pendiente
                  {otras.data === 1 ? '' : 's'} de {nombre} que se rechazarán.
                </span>
              )}
              <span className="mt-2 block">
                Entrega el {formatearFecha(pendiente.fechaEntrega)}
                {pendiente.observacion ? `. Observación: ${pendiente.observacion}` : '.'}
              </span>
            </>
          ) : pendiente ? (
            <>
              <span className="block">
                El adoptante recibirá este motivo: {pendiente.observacion}
              </span>
              <span className="mt-2 block">Esta decisión no se puede deshacer.</span>
            </>
          ) : (
            ''
          )
        }
        textoConfirmar={aprobando ? 'Sí, aprobar y crear la adopción' : 'Sí, rechazar'}
        textoCancelar="Volver"
        destructivo={pendiente?.decision === 'rechazar'}
        cargando={decidir.isPending}
        onConfirmar={() => void confirmar()}
      />
    </section>
  );
}
