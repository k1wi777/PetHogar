import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { formatearFecha } from '@/shared/lib/fechas';
import { BadgeEstado } from '@/shared/ui/BadgeEstado';
import { Boton } from '@/shared/ui/Boton';
import { cn } from '@/shared/lib/utils';
import { admiteReporte, esVencido, estadoVisible, rutaSeguimiento } from '../lib/seguimiento';
import type { ResumenSeguimiento } from '../types';

/** Seguimiento: el vencido se destaca con texto, icono y borde grueso, nunca solo con color (R13). */
export function FilaSeguimiento({ s }: { s: ResumenSeguimiento }) {
  const vencido = esVencido(s);
  return (
    <li
      className={cn(
        'bg-card flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between',
        vencido ? 'border-destructive border-l-8' : 'border-border-suave',
      )}
    >
      <div className="flex flex-col gap-1">
        <p className="font-semibold">
          {s.tipo === 'reporte' ? 'Reporte' : 'Visita'} · fecha límite{' '}
          {formatearFecha(s.fechaProgramada)}
        </p>
        <p className="flex flex-wrap items-center gap-2">
          <span className="sr-only">Estado: </span>
          {vencido && <AlertTriangle className="text-destructive size-4" aria-hidden="true" />}
          <BadgeEstado estado={estadoVisible(s)} />
          {vencido && (
            <span className="text-sm">Venció el {formatearFecha(s.fechaProgramada)}</span>
          )}
          {s.fechaRealizada && (
            <span className="text-muted-foreground text-sm">
              Realizado el {formatearFecha(s.fechaRealizada)}
            </span>
          )}
        </p>
      </div>
      {admiteReporte(s) && (
        <Boton comoHijo variante={vencido ? 'primario' : 'contorno'}>
          <Link href={rutaSeguimiento(s.id)}>Enviar reporte</Link>
        </Boton>
      )}
    </li>
  );
}
