'use client';

import { ArrowLeft, CheckCircle2, Info } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { esErrorApi } from '@/shared/api/errores';
import { formatearFechaBogota } from '@/shared/lib/fechas';
import { AvisoAlerta } from '@/shared/ui/AvisoAlerta';
import { BadgeEstado } from '@/shared/ui/BadgeEstado';
import { Boton } from '@/shared/ui/Boton';
import { BotonDescarga } from '@/shared/ui/BotonDescarga';
import { EstadoError } from '@/shared/ui/EstadoError';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useFundacion } from '../hooks/useAdminFundaciones';
import { RUTA_FUNDACIONES, leerConsulta, leerId, rutaLista } from '../lib/consulta';
import type { DetalleFundacion } from '../types';
import { PanelValidacion } from './PanelValidacion';

function NoEncontrada() {
  return (
    <div className="border-border-suave bg-card flex max-w-xl flex-col items-start gap-3 rounded-lg border p-6">
      <Info className="text-info-foreground size-10" aria-hidden="true" />
      <h1 className="text-2xl">No encontramos esta fundación</h1>
      <p role="status">La fundación no existe o ya no está disponible.</p>
      <Boton comoHijo>
        <Link href={RUTA_FUNDACIONES}>Ir a fundaciones por validar</Link>
      </Boton>
    </div>
  );
}

/** Resultado de la decisión recién tomada; recibe el foco porque el panel puede desaparecer. */
function ResultadoDecision({ f }: { f: DetalleFundacion }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const aprobada = f.estadoValidacion === 'aprobada';
  return (
    <div
      role="status"
      className="border-success bg-card flex flex-col items-start gap-2 rounded-lg border-2 p-4"
    >
      <CheckCircle2 className="text-success size-8" aria-hidden="true" />
      <h2 ref={ref} tabIndex={-1} className="text-2xl focus:outline-2">
        {aprobada ? 'Fundación aprobada' : 'Fundación rechazada'}
      </h2>
      <p>
        {aprobada
          ? 'Ya puede entrar a su panel completo en su siguiente inicio de sesión. Le avisamos por correo.'
          : 'Le avisamos por correo con el motivo del rechazo.'}
      </p>
    </div>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="contents">
      <dt className="font-semibold">{etiqueta}</dt>
      <dd className="min-w-0 break-words whitespace-pre-line">{children}</dd>
    </div>
  );
}

export function PantallaDetalleFundacion({ idTexto }: { idTexto: string }) {
  const id = leerId(idTexto);
  const consulta = leerConsulta(useSearchParams());
  const fundacion = useFundacion(id);
  const [aviso, setAviso] = useState<string | null>(null);
  const [resultado, setResultado] = useState<DetalleFundacion | null>(null);
  const [inexistente, setInexistente] = useState(false);

  if (id === null || inexistente) return <NoEncontrada />;
  if (fundacion.isPending) {
    return <Skeleton className="h-64 max-w-3xl" etiqueta="Cargando la fundación" />;
  }
  if (fundacion.isError) {
    if (esErrorApi(fundacion.error) && [400, 404].includes(fundacion.error.estado)) {
      return <NoEncontrada />;
    }
    return (
      <EstadoError
        error={fundacion.error}
        alReintentar={() => void fundacion.refetch()}
        reintentando={fundacion.isFetching}
      />
    );
  }

  const f = fundacion.data;
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Boton comoHijo variante="fantasma" className="self-start">
        <Link href={rutaLista(consulta)}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a fundaciones
        </Link>
      </Boton>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 text-3xl break-words">{f.nombre}</h1>
        <span aria-live="polite">
          <span className="sr-only">Estado: </span>
          <BadgeEstado estado={f.estadoValidacion} />
        </span>
      </header>

      {aviso && <AvisoAlerta>{aviso}</AvisoAlerta>}
      {resultado && <ResultadoDecision f={resultado} />}

      <section aria-labelledby="titulo-datos" className="flex flex-col gap-3">
        <h2 id="titulo-datos" className="text-2xl">
          Datos de la fundación
        </h2>
        <dl className="border-border-suave bg-card grid gap-x-4 gap-y-3 rounded-lg border p-4 sm:grid-cols-[10rem_1fr]">
          <Dato etiqueta="NIT">{f.nit}</Dato>
          <Dato etiqueta="Ciudad">{f.ciudad}</Dato>
          <Dato etiqueta="Dirección">{f.direccion}</Dato>
          <Dato etiqueta="Descripción">{f.descripcion ?? 'Sin descripción'}</Dato>
          <Dato etiqueta="Correo">
            <a className="text-primary underline" href={`mailto:${f.contacto.email}`}>
              {f.contacto.email}
            </a>
          </Dato>
          <Dato etiqueta="Teléfono">
            <a className="text-primary underline" href={`tel:${f.contacto.telefono}`}>
              {f.contacto.telefono}
            </a>
          </Dato>
          {f.fechaValidacion && (
            <Dato etiqueta="Revisada el">{formatearFechaBogota(f.fechaValidacion)}</Dato>
          )}
          {f.observacionValidacion && (
            <Dato etiqueta="Observación previa">{f.observacionValidacion}</Dato>
          )}
        </dl>
      </section>

      <section aria-labelledby="titulo-documento" className="flex flex-col gap-3">
        <h2 id="titulo-documento" className="text-2xl">
          Documento legal
        </h2>
        <p className="text-muted-foreground">
          Se descarga con tu sesión y se abre con el visor de tu dispositivo (PDF, JPG o PNG).
        </p>
        <BotonDescarga
          url={f.documento.url}
          nombreBase={`documento-legal-fundacion-${f.id}`}
          etiqueta="Descargar documento legal"
          className="w-full self-start sm:w-auto"
        />
      </section>

      <PanelValidacion
        key={f.estadoValidacion}
        fundacion={f}
        alDecidir={(detalle) => {
          setAviso(null);
          setResultado(detalle);
        }}
        alAviso={setAviso}
        alNoEncontrada={() => setInexistente(true)}
      />
    </div>
  );
}
