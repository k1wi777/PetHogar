'use client';

import { PawPrint } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { formatearFecha } from '@/shared/lib/fechas';
import { BadgeEstado } from '@/shared/ui/BadgeEstado';
import { BotonDescarga } from '@/shared/ui/BotonDescarga';
import { Boton } from '@/shared/ui/Boton';
import { EstadoError } from '@/shared/ui/EstadoError';
import { EstadoVacio } from '@/shared/ui/EstadoVacio';
import { Paginacion } from '@/shared/ui/Paginacion';
import { Skeleton } from '@/shared/ui/Skeleton';
import { ADOPCIONES_POR_PAGINA } from '../api/adopciones';
import { useMisAdopciones } from '../hooks/useAdopciones';
import { MAX_SEGUIMIENTOS_RESUMEN, type AdopcionAdoptante } from '../types';
import { FilaSeguimiento } from './FilaSeguimiento';

function TarjetaAdopcion({ a }: { a: AdopcionAdoptante }) {
  return (
    <li className="border-border-suave bg-card flex flex-col gap-4 rounded-lg border p-4">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl">{a.mascota.nombre}</h2>
          <span>
            <span className="sr-only">Estado de la adopción: </span>
            <BadgeEstado estado={a.estado} />
          </span>
        </div>
        <p className="text-muted-foreground text-sm">
          {a.fundacion.nombre} ({a.fundacion.ciudad}) · Entregada el{' '}
          {formatearFecha(a.fechaEntrega)}
        </p>
        {a.motivoCierre && (
          <p className="text-sm">
            <strong>Motivo del cierre:</strong> {a.motivoCierre}
          </p>
        )}
        {a.acta && (
          <div className="mt-2">
            <BotonDescarga
              url={a.acta.url}
              nombreBase={`acta-adopcion-${a.id}`}
              etiqueta={`Descargar acta de ${a.mascota.nombre}`}
            />
          </div>
        )}
      </header>
      <section aria-label={`Seguimientos de ${a.mascota.nombre}`} className="flex flex-col gap-2">
        <h3 className="text-lg font-bold">Seguimientos</h3>
        {a.seguimientos.length === 0 ? (
          <p className="text-muted-foreground">Aún no hay seguimientos programados.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {a.seguimientos.map((s) => (
              <FilaSeguimiento key={s.id} s={s} />
            ))}
          </ul>
        )}
        {a.seguimientos.length >= MAX_SEGUIMIENTOS_RESUMEN && (
          <p className="text-muted-foreground text-sm">
            Mostramos los {MAX_SEGUIMIENTOS_RESUMEN} más recientes.
          </p>
        )}
      </section>
    </li>
  );
}

export function ListaAdopciones() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const bruto = params.get('pagina');
  const pagina = bruto && /^\d{1,6}$/.test(bruto) && Number(bruto) >= 1 ? Number(bruto) : 1;
  const adopciones = useMisAdopciones(pagina);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">Mis adopciones</h1>
        <p className="text-muted-foreground">
          Las mascotas que adoptaste y los seguimientos que acordaste con la fundación.
        </p>
      </div>
      <div aria-live="polite" aria-busy={adopciones.isFetching || undefined}>
        {adopciones.isPending ? (
          <Skeleton className="h-48" etiqueta="Cargando tus adopciones" />
        ) : adopciones.isError ? (
          <EstadoError
            alReintentar={() => void adopciones.refetch()}
            reintentando={adopciones.isFetching}
          />
        ) : adopciones.data.data.length === 0 ? (
          <EstadoVacio
            icono={PawPrint}
            titulo="Aún no tienes adopciones"
            descripcion="Cuando una fundación apruebe una solicitud y te entregue la mascota, aparecerá aquí con sus seguimientos."
            accion={
              <Boton comoHijo>
                <Link href="/adoptar">Ver mascotas en adopción</Link>
              </Boton>
            }
          />
        ) : (
          <ul className="flex flex-col gap-4" aria-label="Adopciones">
            {adopciones.data.data.map((a) => (
              <TarjetaAdopcion key={a.id} a={a} />
            ))}
          </ul>
        )}
      </div>
      {adopciones.data && adopciones.data.total > 0 && (
        <Paginacion
          pagina={adopciones.data.page}
          limite={adopciones.data.limit || ADOPCIONES_POR_PAGINA}
          total={adopciones.data.total}
          onCambio={(p) => router.push(p > 1 ? `${pathname}?pagina=${p}` : pathname)}
        />
      )}
    </div>
  );
}
