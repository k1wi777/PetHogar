'use client';

import { Boton } from '@/shared/ui/Boton';
import { PaginaMensaje } from '@/shared/ui/PaginaMensaje';

/** Mensaje amable de un fallo de carga con reintento (vuelve a renderizar el segmento en el servidor). */
export function ErrorCarga({
  titulo,
  reset,
  children = 'Puede ser un problema temporal. Inténtalo de nuevo en unos segundos.',
}: {
  titulo: string;
  reset: () => void;
  children?: string;
}) {
  return (
    <PaginaMensaje titulo={titulo} accion={<Boton onClick={reset}>Reintentar</Boton>}>
      {children}
    </PaginaMensaje>
  );
}
