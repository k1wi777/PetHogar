'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { esErrorApi, mensajeDe } from '@/shared/api/errores';
import { formatearFecha } from '@/shared/lib/fechas';
import { AvisoAlerta } from '@/shared/ui/AvisoAlerta';
import { BadgeEstado } from '@/shared/ui/BadgeEstado';
import { Boton } from '@/shared/ui/Boton';
import { DialogoConfirmacion } from '@/shared/ui/DialogoConfirmacion';
import { EstadoError } from '@/shared/ui/EstadoError';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useCancelarSolicitud, useSolicitud } from '../hooks/useSolicitudes';
import { leerConsulta, leerId, rutaLista } from '../lib/consulta';
import { ETIQUETA_VIVIENDA, type DetalleSolicitud as Detalle } from '../types';
import { MensajeAviso } from './MensajeAviso';

export function SolicitudNoEncontrada() {
  return (
    <MensajeAviso
      titulo="No encontramos esta solicitud"
      mensaje="La solicitud no existe o no es tuya. Revisa tus solicitudes para ver las que enviaste."
    >
      <Boton comoHijo>
        <Link href="/adoptante/solicitudes">Ir a mis solicitudes</Link>
      </Boton>
    </MensajeAviso>
  );
}

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="contents">
      <dt className="font-semibold">{etiqueta}</dt>
      <dd className="break-words whitespace-pre-line">{children}</dd>
    </div>
  );
}

function Datos({ s }: { s: Detalle }) {
  return (
    <dl className="border-border-suave bg-card grid gap-3 rounded-lg border p-4 sm:grid-cols-[12rem_1fr]">
      <Fila etiqueta="Mascota">{s.mascota.nombre}</Fila>
      <Fila etiqueta="Fundación">{s.fundacion.nombre}</Fila>
      <Fila etiqueta="Enviada el">{formatearFecha(s.fechaSolicitud)}</Fila>
      <Fila etiqueta="Motivo">{s.motivo}</Fila>
      <Fila etiqueta="Tipo de vivienda">{ETIQUETA_VIVIENDA[s.tipoVivienda]}</Fila>
      <Fila etiqueta="Otras mascotas">{s.tieneOtrasMascotas ? 'Sí' : 'No'}</Fila>
      {s.fechaRespuesta && <Fila etiqueta="Respondida el">{formatearFecha(s.fechaRespuesta)}</Fila>}
      {s.observacion && <Fila etiqueta="Observación de la fundación">{s.observacion}</Fila>}
    </dl>
  );
}

/** Detalle de una solicitud propia, con cancelación mientras esté pendiente (R9 a R11). */
export function DetalleSolicitud({ idTexto }: { idTexto: string }) {
  const id = leerId(idTexto);
  const consulta = leerConsulta(useSearchParams());
  const solicitud = useSolicitud(id);
  const cancelar = useCancelarSolicitud(id ?? 0);
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  if (id === null) return <SolicitudNoEncontrada />;
  if (solicitud.isPending)
    return <Skeleton className="h-64 max-w-3xl" etiqueta="Cargando la solicitud" />;
  if (solicitud.isError) {
    // 404 uniforme: una solicitud ajena y una inexistente se ven igual.
    if (
      esErrorApi(solicitud.error) &&
      (solicitud.error.estado === 404 || solicitud.error.estado === 400)
    ) {
      return <SolicitudNoEncontrada />;
    }
    return (
      <EstadoError
        alReintentar={() => void solicitud.refetch()}
        reintentando={solicitud.isFetching}
      />
    );
  }

  const s = solicitud.data;

  function confirmar() {
    setAviso(null);
    cancelar.mutate(undefined, {
      onSuccess: () => setAbierto(false),
      onError: (error) => {
        setAbierto(false);
        if (esErrorApi(error) && error.estado === 404) {
          setAviso('La solicitud no existe o no es tuya.');
        } else if (esErrorApi(error) && error.estado === 409) {
          setAviso(`No se pudo cancelar: ${error.mensaje}. Mostramos su estado actual.`);
        } else {
          setAviso(mensajeDe(error));
        }
      },
    });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Boton comoHijo variante="fantasma" className="self-start">
        <Link href={rutaLista(consulta)}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a mis solicitudes
        </Link>
      </Boton>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl">Solicitud para adoptar a {s.mascota.nombre}</h1>
        <span aria-live="polite">
          <span className="sr-only">Estado: </span>
          <BadgeEstado estado={s.estado} />
        </span>
      </header>

      {aviso && <AvisoAlerta>{aviso}</AvisoAlerta>}

      <Datos s={s} />

      {s.estado === 'pendiente' && (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground">
            Mientras la fundación no responda, puedes cancelar esta solicitud.
          </p>
          <Boton variante="destructivo" className="self-start" onClick={() => setAbierto(true)}>
            Cancelar solicitud
          </Boton>
        </div>
      )}

      <DialogoConfirmacion
        abierto={abierto}
        onAbiertoChange={setAbierto}
        titulo="¿Cancelar esta solicitud?"
        descripcion={`Dejarás de participar en la adopción de ${s.mascota.nombre}. Esta acción no se puede deshacer.`}
        textoConfirmar="Sí, cancelar solicitud"
        textoCancelar="No, conservarla"
        destructivo
        cargando={cancelar.isPending}
        onConfirmar={confirmar}
      />
    </div>
  );
}
