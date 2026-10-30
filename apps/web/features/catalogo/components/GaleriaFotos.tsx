import { PawPrint } from 'lucide-react';
import Image from 'next/image';
import type { FotoPublica } from '../types';

/**
 * Galería sin estado ni JavaScript: figuras en una columna (móvil) o cuadrícula (escritorio), con
 * la principal primero. `unoptimized`: la API ya entrega la versión grande ya procesada.
 */
export function GaleriaFotos({
  fotos,
  nombre,
  especie,
}: {
  fotos: FotoPublica[];
  nombre: string;
  especie: string;
}) {
  const visibles = fotos
    .map((f) => ({ id: f.id, src: f.url ?? f.urlCatalogo }))
    .filter((f): f is { id: number; src: string } => Boolean(f.src));
  if (visibles.length === 0) {
    return (
      <div
        role="img"
        aria-label={`${nombre} aún no tiene fotos`}
        className="bg-muted text-muted-foreground flex aspect-[4/3] items-center justify-center rounded-lg"
      >
        <PawPrint className="size-20" aria-hidden="true" />
      </div>
    );
  }
  return (
    <ul className={`grid gap-3 ${visibles.length > 1 ? 'lg:grid-cols-2' : ''}`}>
      {visibles.map((foto, i) => (
        <li key={foto.id} className={i === 0 && visibles.length > 1 ? 'lg:col-span-2' : undefined}>
          <figure className="bg-muted relative aspect-[4/3] overflow-hidden rounded-lg">
            <Image
              src={foto.src}
              alt={
                visibles.length === 1
                  ? `Foto de ${nombre}, ${especie}`
                  : `Foto ${i + 1} de ${visibles.length} de ${nombre}, ${especie}`
              }
              fill
              unoptimized
              priority={i === 0}
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </figure>
        </li>
      ))}
    </ul>
  );
}
