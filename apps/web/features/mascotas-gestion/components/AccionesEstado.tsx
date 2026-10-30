'use client';

import { useState } from 'react';
import { mensajeDe } from '@/shared/api/errores';
import { Boton } from '@/shared/ui/Boton';
import { DialogoConfirmacion } from '@/shared/ui/DialogoConfirmacion';
import { useDarDeBaja } from '../hooks/useMascotasGestion';
import { esConflicto, esFundacionNoAprobada } from '../lib/errores';
import { explicacionSinBaja, puedeDarDeBaja } from '../lib/estado';
import type { MascotaGestionDetalle } from '../types';

/**
 * Acciones de estado de la ficha. Solo «Dar de baja» (desde disponible); en cualquier otro estado
 * se explica por qué no hay más acciones. La baja es pesimista: el estado cambia al confirmar el servidor.
 */
export function AccionesEstado({
  mascota,
  alBaja,
  alConflicto,
  alNoAprobada,
  alFallo,
}: {
  mascota: MascotaGestionDetalle;
  /** Se invoca tras dar de baja con éxito (la ficha mueve el foco y avisa). */
  alBaja: () => void;
  alConflicto: (mensaje: string) => void;
  alNoAprobada: (mensaje: string) => void;
  alFallo: (mensaje: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const baja = useDarDeBaja(mascota.id);

  if (!puedeDarDeBaja(mascota.estado)) {
    const explicacion = explicacionSinBaja(mascota.estado);
    return explicacion ? <p className="text-muted-foreground max-w-prose">{explicacion}</p> : null;
  }

  function confirmar() {
    baja.mutate(undefined, {
      onSuccess: () => {
        setAbierto(false);
        alBaja();
      },
      onError: (error) => {
        setAbierto(false);
        if (esFundacionNoAprobada(error)) return alNoAprobada(mensajeDe(error));
        if (esConflicto(error)) {
          return alConflicto(`${mensajeDe(error)} Actualizamos la ficha con el estado real.`);
        }
        alFallo(mensajeDe(error));
      },
    });
  }

  return (
    <>
      <Boton variante="destructivo" onClick={() => setAbierto(true)}>
        Dar de baja
      </Boton>
      <DialogoConfirmacion
        abierto={abierto}
        onAbiertoChange={(v) => !baja.isPending && setAbierto(v)}
        titulo={`¿Dar de baja a ${mascota.nombre}?`}
        descripcion="Saldrá del catálogo público y no podrás reactivarla. Esta acción no se puede deshacer."
        textoConfirmar="Sí, dar de baja"
        destructivo
        cargando={baja.isPending}
        onConfirmar={confirmar}
      />
    </>
  );
}
