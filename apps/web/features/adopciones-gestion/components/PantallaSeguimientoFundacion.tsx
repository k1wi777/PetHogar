'use client';

import { AlertTriangle, ArrowLeft, Info } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { mensajeDe } from '@/shared/lib/errores-usuario';
import { formatearFecha } from '@/shared/lib/fechas';
import { esVencido, estadoVisible } from '@/shared/lib/seguimiento';
import { AvisoAlerta } from '@/shared/ui/AvisoAlerta';
import { AvisoFundacionNoAprobada } from '@/shared/ui/AvisoFundacionNoAprobada';
import { BadgeEstado } from '@/shared/ui/BadgeEstado';
import { Boton } from '@/shared/ui/Boton';
import { EstadoError } from '@/shared/ui/EstadoError';
import { GuardaFundacionAprobada } from '@/shared/ui/GuardaFundacionAprobada';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useSeguimientoFundacion } from '../hooks/useAdopcionesGestion';
import { RUTA_ADOPCIONES, leerId } from '../lib/consulta';
import { esFundacionNoAprobada, esNoEncontrada } from '../lib/errores';
import { ETIQUETA_TIPO } from '../types';
import { FormularioResultado } from './FormularioResultado';
import { EsperandoReporte, ReporteDelAdoptante } from './ReporteDelAdoptante';
import { ResultadoRegistrado } from './ResultadoRegistrado';

const Volver = () => (
  <Boton comoHijo variante="fantasma" className="self-start">
    <Link href={RUTA_ADOPCIONES}>
      <ArrowLeft className="size-4" aria-hidden="true" />
      Volver a adopciones
    </Link>
  </Boton>
);

function NoEncontrado() {
  return (
    <div className="border-border-suave bg-card flex max-w-xl flex-col items-start gap-3 rounded-lg border p-6">
      <Info className="text-info-foreground size-10" aria-hidden="true" />
      <h1 className="text-2xl">No encontramos este seguimiento</h1>
      <p role="status">El seguimiento no existe o no es de una adopción de tu fundación.</p>
      <Boton comoHijo>
        <Link href={RUTA_ADOPCIONES}>Ir a adopciones</Link>
      </Boton>
    </div>
  );
}

function Contenido({ idTexto }: { idTexto: string }) {
  const id = leerId(idTexto);
  const seguimiento = useSeguimientoFundacion(id);
  const [aviso, setAviso] = useState<string | null>(null);
  const [registradoAhora, setRegistradoAhora] = useState(false);

  if (id === null) return <NoEncontrado />;
  if (seguimiento.isPending) {
    return <Skeleton className="h-64 max-w-3xl" etiqueta="Cargando el seguimiento" />;
  }
  if (seguimiento.isError) {
    if (esNoEncontrada(seguimiento.error)) return <NoEncontrado />;
    if (esFundacionNoAprobada(seguimiento.error)) {
      return <AvisoFundacionNoAprobada mensajeServidor={mensajeDe(seguimiento.error)} />;
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
  const pendiente = s.estado === 'programado' || s.estado === 'vencido';
  const esperaReporte = s.tipo === 'reporte' && s.reporte === null;
  let cuerpo;
  if (s.estado === 'realizado') {
    cuerpo = <ResultadoRegistrado s={s} enfocar={registradoAhora} />;
  } else if (s.estado === 'cancelado') {
    cuerpo = (
      <p className="border-border-suave bg-card flex items-start gap-2 rounded-lg border p-4">
        <Info className="text-info-foreground mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <span>
          Este seguimiento se canceló al cerrarse la adopción. Es solo de lectura: no hay acciones
          disponibles sobre él.
        </span>
      </p>
    );
  } else if (pendiente && esperaReporte) {
    cuerpo = <EsperandoReporte />;
  } else {
    cuerpo = (
      <FormularioResultado
        seguimiento={s}
        alAviso={setAviso}
        alRegistrado={() => {
          setAviso(null);
          setRegistradoAhora(true);
        }}
      />
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Volver />
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl break-words">
          {s.tipo === 'reporte' ? 'Reporte' : 'Visita'} de seguimiento de {s.mascota.nombre}
        </h1>
        <p className="flex flex-wrap items-center gap-2">
          <span className="sr-only">Estado: </span>
          <BadgeEstado estado={estadoVisible(s)} />
          {esVencido(s) && (
            <span className="text-destructive flex items-center gap-1 text-sm font-semibold">
              <AlertTriangle className="size-4" aria-hidden="true" />
              Venció el {formatearFecha(s.fechaProgramada)}
            </span>
          )}
        </p>
      </header>

      <dl className="border-border-suave bg-card grid gap-x-4 gap-y-3 rounded-lg border p-4 sm:grid-cols-[10rem_1fr]">
        <dt className="font-semibold">Adoptante</dt>
        <dd className="break-words">{s.adoptante.nombreCompleto}</dd>
        <dt className="font-semibold">Tipo</dt>
        <dd>{ETIQUETA_TIPO[s.tipo]}</dd>
        <dt className="font-semibold">Entrega</dt>
        <dd>{formatearFecha(s.fechaEntrega)}</dd>
        <dt className="font-semibold">Fecha límite</dt>
        <dd>{formatearFecha(s.fechaProgramada)}</dd>
      </dl>

      {aviso && <AvisoAlerta>{aviso}</AvisoAlerta>}

      {s.reporte && <ReporteDelAdoptante reporte={s.reporte} />}
      {cuerpo}
    </div>
  );
}

export function PantallaSeguimientoFundacion({ idTexto }: { idTexto: string }) {
  return (
    <GuardaFundacionAprobada>
      <Contenido idTexto={idTexto} />
    </GuardaFundacionAprobada>
  );
}
