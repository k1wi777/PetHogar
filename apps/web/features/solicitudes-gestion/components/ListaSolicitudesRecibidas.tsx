'use client';

import { FileText } from 'lucide-react';
import Link from 'next/link';
import { formatearFecha } from '@/shared/lib/fechas';
import { BadgeEstado } from '@/shared/ui/BadgeEstado';
import { Boton } from '@/shared/ui/Boton';
import { EstadoVacio } from '@/shared/ui/EstadoVacio';
import { rutaRevision } from '../lib/consulta';
import type { ConsultaSolicitudes, ResumenSolicitudRecibida } from '../types';

/** Tarjetas apiladas (a 360 px una tabla obligaría a desplazarse); el estado siempre con texto. */
export function ListaSolicitudesRecibidas({
  solicitudes,
  consulta,
  alQuitarFiltros,
}: {
  solicitudes: ResumenSolicitudRecibida[];
  consulta: ConsultaSolicitudes;
  alQuitarFiltros: () => void;
}) {
  if (solicitudes.length === 0) {
    return consulta.estado || consulta.mascotaId ? (
      <EstadoVacio
        titulo="No hay solicitudes con esos filtros"
        descripcion="Prueba con otro estado u otra mascota, o muestra todas las solicitudes."
        accion={
          <Boton variante="contorno" onClick={alQuitarFiltros}>
            Quitar filtros
          </Boton>
        }
      />
    ) : (
      <EstadoVacio
        icono={FileText}
        titulo="Aún no recibes solicitudes"
        descripcion="Cuando alguien quiera adoptar una de tus mascotas, su solicitud aparecerá aquí."
      />
    );
  }
  return (
    <ul className="flex flex-col gap-3" aria-label="Solicitudes recibidas">
      {solicitudes.map((s) => (
        <li
          key={s.id}
          className="border-border-suave bg-card flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-lg font-bold break-words">{s.mascota.nombre}</p>
            <p className="text-muted-foreground text-sm break-words">
              Solicita {s.adoptante.nombreCompleto} · el {formatearFecha(s.fechaSolicitud)}
            </p>
            <p>
              <span className="sr-only">Estado: </span>
              <BadgeEstado estado={s.estado} />
            </p>
          </div>
          <Boton comoHijo variante="contorno" className="w-full sm:w-auto">
            <Link
              href={rutaRevision(s.id, consulta)}
              aria-label={`Revisar la solicitud de ${s.adoptante.nombreCompleto} para ${s.mascota.nombre}`}
            >
              Revisar
            </Link>
          </Boton>
        </li>
      ))}
    </ul>
  );
}
