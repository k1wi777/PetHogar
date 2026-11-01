'use client';

import { ArrowLeft, CheckCircle2, Info } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { esErrorApi } from '@/shared/api/errores';
import { formatearFecha } from '@/shared/lib/fechas';
import { esVencido, estadoVisible } from '@/shared/lib/seguimiento';
import { BadgeEstado } from '@/shared/ui/BadgeEstado';
import { Boton } from '@/shared/ui/Boton';
import { EstadoError } from '@/shared/ui/EstadoError';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useSeguimiento } from '../hooks/useAdopciones';
import { RUTA_ADOPCIONES, admiteReporte, leerId } from '../lib/seguimiento';
import type { DetalleSeguimiento } from '../types';
import { FormularioReporte } from './FormularioReporte';

const Volver = () => (
  <Boton comoHijo variante="fantasma" className="self-start">
    <Link href={RUTA_ADOPCIONES}>
      <ArrowLeft className="size-4" aria-hidden="true" />
      Volver a mis adopciones
    </Link>
  </Boton>
);

export function SeguimientoNoEncontrado() {
  return (
    <div className="border-border-suave bg-card flex max-w-xl flex-col items-start gap-3 rounded-lg border p-6">
      <Info className="text-info-foreground size-10" aria-hidden="true" />
      <h1 className="text-2xl">No encontramos este seguimiento</h1>
      <p>El seguimiento no existe o no es de una de tus adopciones.</p>
      <Boton comoHijo>
        <Link href={RUTA_ADOPCIONES}>Ir a mis adopciones</Link>
      </Boton>
    </div>
  );
}

function ReporteRecibido({ s }: { s: DetalleSeguimiento }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const reporte = s.reporte!;
  const n = reporte.fotos.length;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      className="border-success bg-card flex max-w-2xl flex-col gap-2 rounded-lg border-2 p-4 focus:outline-2"
    >
      <p className="flex items-center gap-2 text-xl font-bold">
        <CheckCircle2 className="text-success size-6" aria-hidden="true" />
        Reporte recibido
      </p>
      <p>
        Enviado el {formatearFecha(reporte.enviadoEn)}. Gracias por contarnos cómo está{' '}
        {s.mascota.nombre}.
      </p>
      <p className="break-words whitespace-pre-line">
        <strong>Tus comentarios:</strong> {reporte.comentarios}
      </p>
      <p>
        {n === 0 ? 'No enviaste fotos.' : n === 1 ? 'Enviaste 1 foto.' : `Enviaste ${n} fotos.`}
      </p>
    </div>
  );
}

function Explicacion({ children }: { children: string }) {
  return (
    <p className="border-border-suave bg-card flex max-w-2xl items-start gap-2 rounded-lg border p-4">
      <Info className="text-info-foreground mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/** Pantalla de un seguimiento: cuatro estados derivados de lo que dice el servidor (R14, R15). */
export function PantallaSeguimiento({ idTexto }: { idTexto: string }) {
  const id = leerId(idTexto);
  const seguimiento = useSeguimiento(id);

  if (id === null) return <SeguimientoNoEncontrado />;
  if (seguimiento.isPending) {
    return <Skeleton className="h-64 max-w-2xl" etiqueta="Cargando el seguimiento" />;
  }
  if (seguimiento.isError) {
    if (esErrorApi(seguimiento.error) && [400, 404].includes(seguimiento.error.estado)) {
      return <SeguimientoNoEncontrado />;
    }
    return (
      <EstadoError
        error={seguimiento.error}
        alReintentar={() => void seguimiento.refetch()}
        reintentando={seguimiento.isFetching}
      />
    );
  }

  const s = seguimiento.data;
  // El bloqueo sale del dato del servidor: persiste al recargar o volver a entrar.
  const recibido = s.reporte !== null;
  let cuerpo;
  if (recibido) cuerpo = <ReporteRecibido s={s} />;
  else if (s.tipo === 'visita') {
    cuerpo = (
      <Explicacion>
        Este seguimiento es una visita: la fundación se pondrá en contacto contigo, no necesitas
        enviar un reporte.
      </Explicacion>
    );
  } else if (!admiteReporte(s)) {
    cuerpo = (
      <Explicacion>
        {`Este seguimiento ya está cerrado (${s.estado === 'cancelado' ? 'cancelado' : 'realizado'}), por eso no puedes enviar un reporte.`}
      </Explicacion>
    );
  } else cuerpo = <FormularioReporte seguimientoId={s.id} />;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Volver />
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">
          {s.tipo === 'reporte' ? 'Reporte' : 'Visita'} de seguimiento de {s.mascota.nombre}
        </h1>
        <p className="text-muted-foreground">
          {s.fundacion.nombre} · Fecha límite {formatearFecha(s.fechaProgramada)}
        </p>
        {!recibido && (
          <p>
            <span className="sr-only">Estado: </span>
            <BadgeEstado estado={estadoVisible(s)} />
            {esVencido(s) && (
              <span className="ml-2 text-sm">Venció el {formatearFecha(s.fechaProgramada)}</span>
            )}
          </p>
        )}
      </header>
      {cuerpo}
    </div>
  );
}
