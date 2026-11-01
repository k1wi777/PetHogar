'use client';

import { formatearFecha } from '@/shared/lib/fechas';
import { etiquetaTipoHistorial } from '@/shared/lib/formato-mascota';
import { EstadoError } from '@/shared/ui/EstadoError';
import { EstadoVacio } from '@/shared/ui/EstadoVacio';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useHistorial } from '../hooks/useMascotasGestion';
import type { EventoMedico, MascotaGestionDetalle } from '../types';
import { FormularioHistorial } from './FormularioHistorial';

function Lista({ eventos }: { eventos: EventoMedico[] }) {
  if (eventos.length === 0) {
    return (
      <EstadoVacio
        titulo="Aún no hay registros"
        descripcion="Cuando registres vacunas, cirugías o consultas aparecerán aquí."
      />
    );
  }
  return (
    <ul aria-label="Registros médicos" className="flex flex-col gap-3">
      {eventos.map((e) => (
        <li
          key={e.id}
          className="border-border-suave bg-card flex flex-col gap-1 rounded-lg border p-4"
        >
          <p className="font-bold">
            {etiquetaTipoHistorial(e.tipo)} · {formatearFecha(e.fecha)}
          </p>
          <p className="break-words">{e.descripcion}</p>
          {e.veterinario && (
            <p className="text-muted-foreground text-sm">Veterinario: {e.veterinario}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * El backend no ofrece un GET de gestión: la lista pública solo sirve mascotas disponibles. Con otro
 * estado se avisa y solo se ven los registros añadidos en esta sesión (el formulario sigue activo).
 */
export function PestanaHistorial({
  mascota,
  alNoAprobada,
}: {
  mascota: MascotaGestionDetalle;
  alNoAprobada: (mensaje: string) => void;
}) {
  const disponible = mascota.estado === 'disponible';
  const historial = useHistorial(mascota.id, disponible);

  return (
    <section aria-labelledby="titulo-historial" className="flex max-w-3xl flex-col gap-6">
      <h2 id="titulo-historial" className="text-2xl">
        Historial médico
      </h2>
      {!disponible && (
        <p role="status" className="bg-muted rounded-md p-3">
          El historial completo se consulta cuando la mascota está disponible. Aquí solo ves los
          registros que añadas en esta sesión.
        </p>
      )}
      <FormularioHistorial
        mascotaId={mascota.id}
        publicado={disponible}
        alNoAprobada={alNoAprobada}
      />
      <div className="flex flex-col gap-3" aria-live="polite">
        <h3 className="text-xl">Registros</h3>
        {disponible && historial.isPending ? (
          <Skeleton className="h-32" etiqueta="Cargando el historial" />
        ) : disponible && historial.isError ? (
          <EstadoError
            error={historial.error}
            titulo="No pudimos cargar el historial"
            alReintentar={() => void historial.refetch()}
            reintentando={historial.isFetching}
          />
        ) : (
          <Lista eventos={historial.data ?? []} />
        )}
      </div>
    </section>
  );
}
