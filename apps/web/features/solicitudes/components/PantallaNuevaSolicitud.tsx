'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Boton } from '@/shared/ui/Boton';
import { EstadoError } from '@/shared/ui/EstadoError';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useMascotaParaSolicitar } from '../hooks/useSolicitudes';
import { FormularioSolicitud } from './FormularioSolicitud';
import { MensajeAviso } from './MensajeAviso';

/** El id de `?mascota=` debe ser un entero positivo; si no, se trata como «no disponible». */
export function leerMascotaId(valor: string | null): number | null {
  if (!valor || !/^\d{1,10}$/.test(valor)) return null;
  const id = Number(valor);
  return id > 0 ? id : null;
}

export function NoDisponible() {
  return (
    <MensajeAviso
      titulo="Esta mascota ya no está disponible"
      mensaje="No encontramos a esta mascota entre las que esperan una familia. Puede que ya haya sido adoptada."
    >
      <Boton comoHijo>
        <Link href="/adoptar">Ver otras mascotas</Link>
      </Boton>
    </MensajeAviso>
  );
}

export function PantallaNuevaSolicitud() {
  const id = leerMascotaId(useSearchParams().get('mascota'));
  const mascota = useMascotaParaSolicitar(id);

  if (id === null) return <NoDisponible />;
  if (mascota.isPending) {
    return <Skeleton className="h-64 max-w-2xl" etiqueta="Cargando la mascota" />;
  }
  if (mascota.isError) {
    return (
      <EstadoError
        error={mascota.error}
        alReintentar={() => void mascota.refetch()}
        reintentando={mascota.isFetching}
      />
    );
  }
  if (mascota.data === null) return <NoDisponible />;
  return <FormularioSolicitud mascota={mascota.data} />;
}
