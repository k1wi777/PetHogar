import { Skeleton } from '@/shared/ui/Skeleton';

export default function CargandoCatalogo() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Skeleton etiqueta="Cargando mascotas" className="h-8 w-64" />
      <div aria-hidden="true" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="bg-muted h-64 animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}
