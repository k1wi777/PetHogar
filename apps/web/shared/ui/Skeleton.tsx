import { cn } from '@/shared/lib/utils';

/** Marcador de carga: el contenedor anuncia «Cargando» y las barras se ocultan a lectores de pantalla. */
export function Skeleton({
  className,
  etiqueta = 'Cargando',
}: {
  className?: string;
  etiqueta?: string;
}) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">{etiqueta}…</span>
      <div
        aria-hidden="true"
        className={cn('bg-muted h-full min-h-4 w-full animate-pulse rounded-md')}
      />
    </div>
  );
}
