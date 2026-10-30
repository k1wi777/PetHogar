'use client';

import { CalendarPlus } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { formatearFecha } from '@/shared/lib/fechas';
import { BadgeEstado } from '@/shared/ui/BadgeEstado';
import { Boton } from '@/shared/ui/Boton';
import type { AdopcionFundacion, DetalleSeguimientoFundacion } from '../types';
import { LineaTiempoSeguimientos } from './LineaTiempoSeguimientos';
import { PanelProgramarSeguimiento } from './PanelProgramarSeguimiento';

const CORREO = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/** Una adopción: adoptante, entrega, estado, cierre (solo lectura), línea de tiempo y programar. */
export function TarjetaAdopcion({
  adopcion: a,
  panelAbierto,
  alAbrirPanel,
  alCerrarPanel,
  foco,
  alProgramado,
  alFocoAplicado,
}: {
  adopcion: AdopcionFundacion;
  panelAbierto: boolean;
  alAbrirPanel: () => void;
  /** `devolverFoco` es falso al programar con éxito (el foco va a la nueva fila). */
  alCerrarPanel: (devolverFoco: boolean) => void;
  /** Seguimiento recién programado en esta adopción, para enfocar su fila. */
  foco: number | null;
  alProgramado: (seguimiento: DetalleSeguimientoFundacion) => void;
  alFocoAplicado: () => void;
}) {
  const idPanel = useId();
  const idBoton = `${idPanel}-boton`;
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const eraAbierto = useRef(false);

  // Al cerrar el panel (cancelar) el foco vuelve al botón que lo abrió.
  useEffect(() => {
    if (eraAbierto.current && !panelAbierto && foco === null)
      document.getElementById(idBoton)?.focus();
    eraAbierto.current = panelAbierto;
  }, [panelAbierto, foco, idBoton]);

  // Tras programar: foco en la nueva fila o, si no se encuentra, en el encabezado de la línea de tiempo.
  useEffect(() => {
    if (foco === null) return;
    const fila = document.getElementById(`seguimiento-${foco}`);
    (fila ?? tituloRef.current)?.focus();
    alFocoAplicado();
  }, [foco, a.seguimientos, alFocoAplicado]);

  const correo = CORREO.test(a.adoptante.email);
  const cerrada = a.estado !== 'activa';
  return (
    <article
      aria-labelledby={`adopcion-${a.id}`}
      className="border-border-suave bg-card flex flex-col gap-4 rounded-lg border p-4"
    >
      <header className="flex flex-wrap items-center gap-3">
        <h2 id={`adopcion-${a.id}`} className="min-w-0 text-2xl break-words">
          {a.mascota.nombre}
        </h2>
        <span>
          <span className="sr-only">Estado de la adopción: </span>
          <BadgeEstado estado={a.estado} />
        </span>
      </header>
      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[9rem_1fr]">
        <dt className="font-semibold">Adoptante</dt>
        <dd className="break-words">{a.adoptante.nombreCompleto}</dd>
        <dt className="font-semibold">Contacto</dt>
        <dd className="min-w-0 break-words">
          {correo ? (
            <a href={`mailto:${a.adoptante.email}`} className="text-primary break-all underline">
              {a.adoptante.email}
            </a>
          ) : (
            a.adoptante.email
          )}{' '}
          · {a.adoptante.telefono} · {a.adoptante.ciudad}
        </dd>
        <dt className="font-semibold">Entrega</dt>
        <dd>{formatearFecha(a.fechaEntrega)}</dd>
        {cerrada && (
          <>
            <dt className="font-semibold">Cierre</dt>
            <dd className="break-words">
              {a.fechaCierre ? `${formatearFecha(a.fechaCierre)}. ` : ''}
              {a.motivoCierre ?? 'Sin motivo registrado.'}
            </dd>
          </>
        )}
      </dl>

      <LineaTiempoSeguimientos
        ref={tituloRef}
        mascota={a.mascota.nombre}
        seguimientos={a.seguimientos}
      />

      {!cerrada && (
        <div className="flex flex-col gap-3">
          <Boton
            id={idBoton}
            variante="secundario"
            aria-expanded={panelAbierto}
            aria-controls={idPanel}
            onClick={panelAbierto ? () => alCerrarPanel(true) : alAbrirPanel}
            className="w-full self-start sm:w-auto"
          >
            <CalendarPlus className="size-4" aria-hidden="true" />
            Programar seguimiento
          </Boton>
          {panelAbierto && (
            <PanelProgramarSeguimiento
              id={idPanel}
              adopcion={a}
              alProgramado={alProgramado}
              alCancelar={() => alCerrarPanel(true)}
            />
          )}
        </div>
      )}
      {cerrada && (
        <p className="text-muted-foreground text-sm">
          Esta adopción está cerrada: ya no se pueden programar seguimientos.
        </p>
      )}
    </article>
  );
}
