'use client';

import Link from 'next/link';
import type { Ref } from 'react';
import { EstadoError } from '@/shared/ui/EstadoError';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useNotificacionesRecientes } from '../hooks/useNotificaciones';
import { ItemNotificacion } from './ItemNotificacion';
import { MarcarTodas } from './MarcarTodas';

/** Contenido del menú de la campana: las notificaciones más recientes y accesos a la lista. */
export function MenuNotificaciones({
  id,
  hrefLista,
  sinLeer,
  refTitulo,
  alCerrar,
}: {
  id: string;
  hrefLista: string;
  sinLeer: number | undefined;
  refTitulo: Ref<HTMLHeadingElement>;
  alCerrar: () => void;
}) {
  const recientes = useNotificacionesRecientes(true);
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titulo`}
      className="bg-card border-border-suave fixed top-16 right-2 z-40 flex max-h-[calc(100dvh-5rem)] w-[min(24rem,calc(100vw-1rem))] flex-col gap-3 overflow-y-auto rounded-lg border p-3 shadow-xl"
    >
      <h2
        id={`${id}-titulo`}
        ref={refTitulo}
        tabIndex={-1}
        className="font-heading text-lg font-bold focus:outline-none"
      >
        Notificaciones
      </h2>

      {recientes.isPending ? (
        <Skeleton className="h-24" etiqueta="Cargando las notificaciones" />
      ) : recientes.isError ? (
        <EstadoError
          error={recientes.error}
          titulo="No pudimos cargar tus notificaciones"
          alReintentar={() => void recientes.refetch()}
          reintentando={recientes.isFetching}
        />
      ) : recientes.data.data.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center">Todavía no tienes notificaciones.</p>
      ) : (
        <ul className="flex flex-col" aria-label="Notificaciones recientes">
          {recientes.data.data.map((n) => (
            <li key={n.id}>
              <ItemNotificacion notificacion={n} alAbrir={alCerrar} />
            </li>
          ))}
        </ul>
      )}

      <MarcarTodas deshabilitado={!sinLeer} />
      <Link
        href={hrefLista}
        onClick={alCerrar}
        className="text-primary min-h-11 py-2 text-center font-semibold underline"
      >
        Ver todas las notificaciones
      </Link>
    </section>
  );
}
