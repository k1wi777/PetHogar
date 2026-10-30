'use client';

import { useEspecieDeRaza } from '../hooks/useMascotasGestion';
import { explicacionSoloLectura, puedeEditar } from '../lib/estado';
import type { MascotaGestionDetalle } from '../types';
import { DatosSoloLectura } from './DatosSoloLectura';
import { FormularioMascota } from './FormularioMascota';
import { EstadoError } from '@/shared/ui/EstadoError';
import { Skeleton } from '@/shared/ui/Skeleton';

function Edicion({
  mascota,
  alConflicto,
}: {
  mascota: MascotaGestionDetalle;
  alConflicto: (mensaje: string) => void;
}) {
  const origen = useEspecieDeRaza(mascota.razaId);
  if (origen.cargando) return <Skeleton className="h-64 max-w-2xl" etiqueta="Cargando los datos" />;
  if (origen.error) {
    return (
      <EstadoError
        titulo="No pudimos cargar la especie y la raza"
        alReintentar={origen.reintentar}
      />
    );
  }
  return (
    <FormularioMascota
      modo="editar"
      mascota={mascota}
      especieId={origen.especieId}
      alConflicto={alConflicto}
    />
  );
}

/** Edición mientras la mascota esté disponible o en proceso; en otro caso, solo lectura con la razón. */
export function PestanaDatos({
  mascota,
  alConflicto,
}: {
  mascota: MascotaGestionDetalle;
  alConflicto: (mensaje: string) => void;
}) {
  if (!puedeEditar(mascota.estado)) {
    return (
      <DatosSoloLectura mascota={mascota} razon={explicacionSoloLectura(mascota.estado) ?? ''} />
    );
  }
  return <Edicion mascota={mascota} alConflicto={alConflicto} />;
}
