'use client';

import { ArrowLeft, CheckCircle2, Info } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { formatearFecha } from '@/shared/lib/fechas';
import { AvisoAlerta } from '@/shared/ui/AvisoAlerta';
import { AvisoFundacionNoAprobada } from '@/shared/ui/AvisoFundacionNoAprobada';
import { BadgeEstado } from '@/shared/ui/BadgeEstado';
import { Boton } from '@/shared/ui/Boton';
import { EstadoError } from '@/shared/ui/EstadoError';
import { GuardaFundacionAprobada } from '@/shared/ui/GuardaFundacionAprobada';
import { Skeleton } from '@/shared/ui/Skeleton';
import { mensajeDe } from '@/shared/lib/errores-usuario';
import { useSolicitudRecibida } from '../hooks/useSolicitudesGestion';
import { RUTA_ADOPCIONES, leerConsulta, leerId, rutaLista } from '../lib/consulta';
import { esFundacionNoAprobada, esNoEncontrada } from '../lib/errores';
import type { DetalleSolicitudRecibida } from '../types';
import { DatosSolicitudRecibida } from './DatosSolicitudRecibida';
import { PanelDecision } from './PanelDecision';

function NoEncontrada() {
  return (
    <div className="border-border-suave bg-card flex max-w-xl flex-col items-start gap-3 rounded-lg border p-6">
      <Info className="text-info-foreground size-10" aria-hidden="true" />
      <h1 className="text-2xl">No encontramos esta solicitud</h1>
      <p role="status">
        La solicitud no existe o no es de una mascota de tu fundación. Revisa tus solicitudes
        recibidas.
      </p>
      <Boton comoHijo>
        <Link href="/fundacion/solicitudes">Ir a solicitudes recibidas</Link>
      </Boton>
    </div>
  );
}

/** Resultado de la decisión recién tomada; recibe el foco porque el panel de decisión desaparece. */
function ResultadoDecision({ s }: { s: DetalleSolicitudRecibida }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const aprobada = s.estado === 'aprobada';
  return (
    <div
      role="status"
      className="border-success bg-card flex flex-col items-start gap-3 rounded-lg border-2 p-4"
    >
      <CheckCircle2 className="text-success size-8" aria-hidden="true" />
      <h2 ref={ref} tabIndex={-1} className="text-2xl focus:outline-2">
        {aprobada ? 'Solicitud aprobada' : 'Solicitud rechazada'}
      </h2>
      {aprobada ? (
        <>
          <p>
            Adopción creada: la entrega de {s.mascota.nombre} es el{' '}
            {s.adopcion ? formatearFecha(s.adopcion.fechaEntrega) : 'día acordado'}. Las demás
            solicitudes pendientes de esta mascota se rechazaron automáticamente.
          </p>
          <p className="text-muted-foreground">
            Ahora puedes programar el primer seguimiento desde «Adopciones».
          </p>
          <Boton comoHijo className="w-full sm:w-auto">
            <Link href={RUTA_ADOPCIONES}>Ir a adopciones</Link>
          </Boton>
        </>
      ) : (
        <p>El adoptante recibió el motivo del rechazo.</p>
      )}
    </div>
  );
}

function Contenido({ idTexto }: { idTexto: string }) {
  const id = leerId(idTexto);
  const consulta = leerConsulta(useSearchParams());
  const solicitud = useSolicitudRecibida(id);
  const [aviso, setAviso] = useState<string | null>(null);
  const [resultado, setResultado] = useState<DetalleSolicitudRecibida | null>(null);
  const [ajena, setAjena] = useState(false);

  if (id === null || ajena) return <NoEncontrada />;
  if (solicitud.isPending) {
    return <Skeleton className="h-64 max-w-3xl" etiqueta="Cargando la solicitud" />;
  }
  if (solicitud.isError) {
    if (esNoEncontrada(solicitud.error)) return <NoEncontrada />;
    if (esFundacionNoAprobada(solicitud.error)) {
      return <AvisoFundacionNoAprobada mensajeServidor={mensajeDe(solicitud.error)} />;
    }
    return (
      <EstadoError
        error={solicitud.error}
        alReintentar={() => void solicitud.refetch()}
        reintentando={solicitud.isFetching}
      />
    );
  }

  const s = solicitud.data;
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Boton comoHijo variante="fantasma" className="self-start">
        <Link href={rutaLista(consulta)}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a solicitudes recibidas
        </Link>
      </Boton>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 text-3xl break-words">Solicitud para {s.mascota.nombre}</h1>
        <span aria-live="polite">
          <span className="sr-only">Estado: </span>
          <BadgeEstado estado={s.estado} />
        </span>
      </header>

      {aviso && <AvisoAlerta>{aviso}</AvisoAlerta>}
      {resultado && <ResultadoDecision s={resultado} />}

      <DatosSolicitudRecibida s={s} />

      {s.estado === 'pendiente' ? (
        <PanelDecision
          solicitud={s}
          alDecidir={(detalle) => {
            setAviso(null);
            setResultado(detalle);
          }}
          alAviso={setAviso}
          alNoEncontrada={() => setAjena(true)}
        />
      ) : (
        <section aria-labelledby="titulo-decidida" className="flex flex-col gap-2">
          <h2 id="titulo-decidida" className="text-2xl">
            Decisión
          </h2>
          <dl className="border-border-suave bg-card grid gap-x-4 gap-y-3 rounded-lg border p-4 sm:grid-cols-[10rem_1fr]">
            <div className="contents">
              <dt className="font-semibold">Estado</dt>
              <dd>
                <BadgeEstado estado={s.estado} />
              </dd>
            </div>
            {s.fechaRespuesta && (
              <div className="contents">
                <dt className="font-semibold">Respondida el</dt>
                <dd>{formatearFecha(s.fechaRespuesta)}</dd>
              </div>
            )}
            {s.observacion && (
              <div className="contents">
                <dt className="font-semibold">Observación</dt>
                <dd className="min-w-0 break-words whitespace-pre-line">{s.observacion}</dd>
              </div>
            )}
          </dl>
        </section>
      )}
    </div>
  );
}

export function PantallaRevisionSolicitud({ idTexto }: { idTexto: string }) {
  return (
    <GuardaFundacionAprobada>
      <Contenido idTexto={idTexto} />
    </GuardaFundacionAprobada>
  );
}
