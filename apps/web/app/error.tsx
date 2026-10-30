'use client';

import { Boton } from '@/shared/ui/Boton';
import { PaginaMensaje } from '@/shared/ui/PaginaMensaje';

export default function ErrorInesperado({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="contenido">
      <PaginaMensaje titulo="Algo salió mal" accion={<Boton onClick={reset}>Reintentar</Boton>}>
        Tuvimos un problema inesperado. Inténtalo de nuevo; si continúa, vuelve más tarde.
      </PaginaMensaje>
    </main>
  );
}
