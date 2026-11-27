import { PawPrint } from 'lucide-react';
import Image from 'next/image';
import type { FotoPublica } from '../types';

/**
 * Galería sin estado ni JavaScript: la principal primero, grande y cuadrada, y las demás debajo en
 * dos columnas. `unoptimized`: la API ya entrega la versión grande ya procesada.
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
        className="bg-secondary text-primary flex aspect-square items-center justify-center rounded-xl"
      >
        <PawPrint className="size-32 -rotate-12" aria-hidden="true" />
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-3">
      {visibles.map((foto, i) => (
        <li key={foto.id} className={i === 0 ? 'col-span-2' : undefined}>
          <figure
            className={`bg-muted relative overflow-hidden rounded-xl ${i === 0 ? 'aspect-square shadow-lg' : 'aspect-[4/3]'}`}
          >
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
              sizes={i === 0 ? '(min-width: 1024px) 55vw, 100vw' : '(min-width: 1024px) 28vw, 50vw'}
              className="object-cover"
            />
          </figure>
        </li>
      ))}
    </ul>
  );
}
