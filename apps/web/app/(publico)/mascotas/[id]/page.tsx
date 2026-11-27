import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { obtenerFicha } from '@/features/catalogo/api/mascotas';
import { AccionAdoptar } from '@/features/catalogo/components/AccionAdoptar';
import { BotonDescargarFicha } from '@/features/catalogo/components/BotonDescargarFicha';
import { DatosMascota } from '@/features/catalogo/components/DatosMascota';
import { FundacionResponsable } from '@/features/catalogo/components/FundacionResponsable';
import { GaleriaFotos } from '@/features/catalogo/components/GaleriaFotos';
import { HistorialMedico } from '@/features/catalogo/components/HistorialMedico';
import { METADATOS_NO_ENCONTRADA, metadatosFicha } from '@/features/catalogo/lib/metadatos';
import { BadgeEstado } from '@/shared/ui/BadgeEstado';

// La página y `generateMetadata` comparten una sola consulta por petición.
const fichaDe = cache((id: string) => obtenerFicha(id));

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  // Si la consulta falla se hereda el título del sitio; la página propaga el error a `error.tsx`.
  const ficha = await fichaDe(id).catch(() => undefined);
  if (ficha === undefined) return {};
  return ficha ? metadatosFicha(ficha) : METADATOS_NO_ENCONTRADA;
}

export default async function FichaPage({ params }: Props) {
  const { id } = await params;
  const ficha = await fichaDe(id);
  if (!ficha) notFound();
  return (
    <div className="mx-auto max-w-6xl px-4 py-4 sm:py-6">
      <Link
        href="/adoptar"
        className="hover:bg-muted -ml-3 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 font-semibold"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver al catálogo
      </Link>
      {/* Móvil: foto, nombre y acción. Escritorio: la foto a la izquierda y todo lo demás al lado. */}
      <div className="mt-2 grid items-start gap-6 lg:grid-cols-[6fr_5fr] lg:gap-10">
        <GaleriaFotos fotos={ficha.fotos} nombre={ficha.nombre} especie={ficha.especie} />
        <div className="flex min-w-0 flex-col gap-8">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-portada min-w-0 break-words">{ficha.nombre}</h1>
              <BadgeEstado estado="disponible" />
            </div>
            <div className="flex flex-col items-start gap-3">
              <AccionAdoptar mascotaId={ficha.id} />
              <BotonDescargarFicha mascotaId={ficha.id} nombre={ficha.nombre} />
            </div>
          </div>
          <DatosMascota ficha={ficha} />
          <HistorialMedico eventos={ficha.historial} />
          <FundacionResponsable fundacion={ficha.fundacion} />
        </div>
      </div>
    </div>
  );
}
