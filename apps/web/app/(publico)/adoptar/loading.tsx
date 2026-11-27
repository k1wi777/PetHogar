import { Skeleton } from '@/shared/ui/Skeleton';

export default function CargandoCatalogo() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-titulo">Mascotas disponibles</h1>
      <Skeleton etiqueta="Cargando mascotas" className="mt-6 h-7 w-56 max-w-full" />
      <div aria-hidden="true" className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="bg-card border-border-suave overflow-hidden rounded-xl border">
            <div className="bg-muted aspect-[4/5] animate-pulse" />
            <div className="flex flex-col gap-2 p-5">
              <div className="bg-muted h-7 w-1/2 animate-pulse rounded-full" />
              <div className="bg-muted h-4 w-3/4 animate-pulse rounded-full" />
              <div className="bg-muted h-4 w-2/3 animate-pulse rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
