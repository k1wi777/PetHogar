import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { EstadoError } from '@/shared/ui/EstadoError';
import { EstadoVacio } from '@/shared/ui/EstadoVacio';
import { Skeleton } from '@/shared/ui/Skeleton';
import { TarjetaResumen, type EnlaceResumen } from './TarjetaResumen';

type Consulta<T> = Pick<
  UseQueryResult<T>,
  'data' | 'isPending' | 'isError' | 'error' | 'refetch' | 'isFetching'
>;

/**
 * Decide el estado de una sección con su propia consulta: carga (esqueleto solo aquí), error
 * amable con «Reintentar», vacío con su acción, o el contenido. Un fallo no afecta a las demás.
 */
export function SeccionResumen<T>({
  titulo,
  consulta,
  enlace,
  esVacio,
  vacio,
  children,
}: {
  titulo: string;
  consulta: Consulta<T>;
  enlace?: EnlaceResumen;
  esVacio?: (datos: T) => boolean;
  vacio?: { titulo: string; descripcion?: string; accion?: ReactNode };
  children: (datos: T) => ReactNode;
}) {
  if (consulta.isError) {
    return (
      <section aria-label={titulo} className="min-w-0">
        <EstadoError
          titulo={`No pudimos cargar ${titulo.toLowerCase()}`}
          error={consulta.error}
          alReintentar={() => void consulta.refetch()}
          reintentando={consulta.isFetching}
        />
      </section>
    );
  }
  if (consulta.isPending || consulta.data === undefined) {
    return (
      <TarjetaResumen titulo={titulo} ocupada>
        <Skeleton className="h-24" />
      </TarjetaResumen>
    );
  }
  if (esVacio?.(consulta.data) && vacio) {
    return (
      <section aria-label={titulo} className="min-w-0">
        <EstadoVacio {...vacio} encabezado="h2" />
      </section>
    );
  }
  return (
    <TarjetaResumen titulo={titulo} enlace={enlace}>
      {children(consulta.data)}
    </TarjetaResumen>
  );
}

/** Rejilla de una columna y dos desde `md`; `min-w-0` evita que un nombre largo ensanche la página. */
export function RejillaResumen({ children }: { children: ReactNode }) {
  return <div className="grid min-w-0 gap-4 md:grid-cols-2">{children}</div>;
}
