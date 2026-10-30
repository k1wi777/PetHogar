'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { forwardRef } from 'react';
import { formatearFecha } from '@/shared/lib/fechas';
import { esVencido, estadoVisible } from '@/shared/lib/seguimiento';
import { BadgeEstado } from '@/shared/ui/BadgeEstado';
import { Boton } from '@/shared/ui/Boton';
import { cn } from '@/shared/lib/utils';
import { rutaSeguimiento } from '../lib/consulta';
import { ETIQUETA_TIPO, MAX_SEGUIMIENTOS_RESUMEN, type ResumenSeguimiento } from '../types';

function textoAccion(s: ResumenSeguimiento): string {
  if (s.estado === 'realizado') return 'Ver resultado';
  if (s.estado === 'cancelado') return 'Ver detalle';
  return s.tipo === 'reporte' ? 'Revisar reporte' : 'Registrar resultado';
}

/** Orden cronológico por fecha límite (desempate por id): el ciclo se lee de arriba abajo. */
export function ordenarSeguimientos(seguimientos: ResumenSeguimiento[]): ResumenSeguimiento[] {
  return [...seguimientos].sort(
    (a, b) => a.fechaProgramada.localeCompare(b.fechaProgramada) || a.id - b.id,
  );
}

/**
 * Historial de la adopción con los seguimientos que entrega la API (los 20 más recientes). El
 * vencido se señala con icono, texto y borde grueso, nunca solo con color.
 */
export const LineaTiempoSeguimientos = forwardRef<
  HTMLHeadingElement,
  { mascota: string; seguimientos: ResumenSeguimiento[] }
>(function LineaTiempoSeguimientos({ mascota, seguimientos }, refTitulo) {
  return (
    <div className="flex flex-col gap-2">
      <h3 ref={refTitulo} tabIndex={-1} className="text-lg font-bold focus:outline-2">
        Seguimientos
      </h3>
      {seguimientos.length === 0 ? (
        <p className="text-muted-foreground">Aún no hay seguimientos programados.</p>
      ) : (
        <ol aria-label={`Seguimientos de ${mascota}`} className="flex flex-col gap-2">
          {ordenarSeguimientos(seguimientos).map((s) => {
            const vencido = esVencido(s);
            return (
              <li
                key={s.id}
                id={`seguimiento-${s.id}`}
                tabIndex={-1}
                className={cn(
                  'bg-muted/40 flex flex-col gap-2 rounded-md border p-3 focus:outline-2 sm:flex-row sm:items-center sm:justify-between',
                  vencido ? 'border-destructive border-l-8' : 'border-border-suave',
                )}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="font-semibold">{ETIQUETA_TIPO[s.tipo]}</p>
                  <p className="text-muted-foreground text-sm">
                    Fecha límite: {formatearFecha(s.fechaProgramada)}
                    {s.fechaRealizada ? ` · Realizado el ${formatearFecha(s.fechaRealizada)}` : ''}
                  </p>
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="sr-only">Estado: </span>
                    <BadgeEstado estado={estadoVisible(s)} />
                    {vencido && (
                      <span className="text-destructive flex items-center gap-1 text-sm font-semibold">
                        <AlertTriangle className="size-4" aria-hidden="true" />
                        Venció el {formatearFecha(s.fechaProgramada)}
                      </span>
                    )}
                  </p>
                </div>
                <Boton comoHijo variante="contorno" className="w-full sm:w-auto">
                  <Link
                    href={rutaSeguimiento(s.id)}
                    aria-label={`${textoAccion(s)}: ${ETIQUETA_TIPO[s.tipo]} del ${formatearFecha(s.fechaProgramada)} de ${mascota}`}
                  >
                    {textoAccion(s)}
                  </Link>
                </Boton>
              </li>
            );
          })}
        </ol>
      )}
      {seguimientos.length >= MAX_SEGUIMIENTOS_RESUMEN && (
        <p className="text-muted-foreground text-sm">
          Mostramos los {MAX_SEGUIMIENTOS_RESUMEN} seguimientos más recientes.
        </p>
      )}
    </div>
  );
});
