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
  const ficha = await fichaDe(id);
  return ficha ? metadatosFicha(ficha) : METADATOS_NO_ENCONTRADA;
}

export default async function FichaPage({ params }: Props) {
  const { id } = await params;
  const ficha = await fichaDe(id);
  if (!ficha) notFound();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/adoptar"
        className="hover:bg-muted -ml-3 inline-flex min-h-11 items-center gap-1 rounded-md px-3 font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver al catálogo
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-4xl">{ficha.nombre}</h1>
        <BadgeEstado estado="disponible" />
      </div>
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <GaleriaFotos fotos={ficha.fotos} nombre={ficha.nombre} especie={ficha.especie} />
        <div className="flex flex-col gap-6">
          <DatosMascota ficha={ficha} />
          <div className="flex flex-wrap items-start gap-4">
            <AccionAdoptar mascotaId={ficha.id} />
            <BotonDescargarFicha mascotaId={ficha.id} nombre={ficha.nombre} />
          </div>
          <HistorialMedico eventos={ficha.historial} />
          <FundacionResponsable fundacion={ficha.fundacion} />
        </div>
      </div>
    </div>
  );
}
