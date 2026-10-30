import { PawPrint } from 'lucide-react';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { BadgeEstado } from './BadgeEstado';

export interface DatosTarjetaMascota {
  nombre: string;
  especie: string;
  raza?: string | null;
  /** Texto ya formateado, p. ej. «2 años». */
  edad?: string | null;
  fotoUrl?: string | null;
  estado?: string;
}

/** Tarjeta de mascota; el enlace (si lo hay) lo aporta quien la usa mediante `children`. */
export function TarjetaMascota({
  mascota,
  children,
}: {
  mascota: DatosTarjetaMascota;
  children?: ReactNode;
}) {
  const detalle = [mascota.especie, mascota.raza, mascota.edad].filter(Boolean).join(' · ');
  return (
    <article className="bg-card border-border-suave flex flex-col overflow-hidden rounded-lg border shadow-sm">
      <div className="bg-muted relative aspect-[4/3]">
        {mascota.fotoUrl ? (
          <Image
            src={mascota.fotoUrl}
            alt={`Foto de ${mascota.nombre}, ${mascota.especie}`}
            fill
            unoptimized
            sizes="(min-width: 768px) 33vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div
            role="img"
            aria-label={`${mascota.nombre} aún no tiene foto`}
            className="text-muted-foreground flex h-full items-center justify-center"
          >
            <PawPrint className="size-12" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-heading text-xl font-bold">{mascota.nombre}</h3>
          {mascota.estado && <BadgeEstado estado={mascota.estado} />}
        </div>
        <p className="text-muted-foreground text-sm">{detalle}</p>
        {children}
      </div>
    </article>
  );
}
