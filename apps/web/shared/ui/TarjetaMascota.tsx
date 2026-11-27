import { PawPrint } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
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
  /** Si existe, el nombre es un enlace cuya área clicable cubre toda la tarjeta. */
  href?: string;
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
    <article className="tarjeta-mascota bg-card border-border-suave relative flex h-full flex-col overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-lg">
      <div className="bg-muted relative aspect-[4/5] overflow-hidden">
        {mascota.fotoUrl ? (
          <Image
            src={mascota.fotoUrl}
            alt={`Foto de ${mascota.nombre}, ${mascota.especie}`}
            fill
            unoptimized
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="foto-tarjeta object-cover"
          />
        ) : (
          <div
            role="img"
            aria-label={`${mascota.nombre} aún no tiene foto`}
            className="bg-secondary text-primary flex h-full items-center justify-center"
          >
            <PawPrint className="size-24 -rotate-12" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-heading text-2xl font-extrabold break-words">
            {mascota.href ? (
              <Link href={mascota.href} className="after:absolute after:inset-0">
                {mascota.nombre}
              </Link>
            ) : (
              mascota.nombre
            )}
          </h3>
          {mascota.estado && <BadgeEstado estado={mascota.estado} />}
        </div>
        <p className="text-base font-medium">{detalle}</p>
        {children}
      </div>
    </article>
  );
}
