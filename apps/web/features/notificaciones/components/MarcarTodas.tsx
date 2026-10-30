'use client';

import { CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { traducirError } from '@/shared/lib/errores-formulario';
import { Boton } from '@/shared/ui/Boton';
import { useLeerTodas } from '../hooks/useNotificaciones';

/** «Marcar todas como leídas»: confirma el resultado en una región de estado accesible. */
export function MarcarTodas({ deshabilitado = false }: { deshabilitado?: boolean }) {
  const leerTodas = useLeerTodas();
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);

  function marcar() {
    setMensaje(null);
    leerTodas.mutate(undefined, {
      onSuccess: ({ actualizadas }) =>
        setMensaje({
          texto:
            actualizadas === 1
              ? 'Marcamos 1 notificación como leída.'
              : `Marcamos ${actualizadas} notificaciones como leídas.`,
          error: false,
        }),
      onError: (error) => setMensaje({ texto: textoDeError(error), error: true }),
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Boton
        variante="contorno"
        onClick={marcar}
        cargando={leerTodas.isPending}
        disabled={deshabilitado}
      >
        <CheckCheck className="size-4" aria-hidden="true" />
        Marcar todas como leídas
      </Boton>
      <div role={mensaje?.error ? 'alert' : 'status'} className="text-sm">
        {mensaje && (
          <p className={mensaje.error ? 'text-destructive break-words' : 'text-muted-foreground'}>
            {mensaje.texto}
          </p>
        )}
      </div>
    </div>
  );
}

function textoDeError(error: unknown): string {
  const salida = traducirError(error, []);
  return salida.tipo === 'campos'
    ? (salida.aviso ?? 'No pudimos completar la acción.')
    : salida.mensaje;
}
