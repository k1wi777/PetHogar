'use client';

import { Boton } from './Boton';
import { PaginaMensaje } from './PaginaMensaje';

/** Contenido de los `error.tsx`: mensaje en español sin pila técnica y «Reintentar». */
export function PaginaError({ reset }: { reset: () => void }) {
  return (
    <PaginaMensaje titulo="Algo salió mal" accion={<Boton onClick={reset}>Reintentar</Boton>}>
      Tuvimos un problema inesperado. Inténtalo de nuevo; si continúa, vuelve más tarde.
    </PaginaMensaje>
  );
}

/** Contenido de los `not-found.tsx`. */
export function PaginaNoEncontrada() {
  return (
    <PaginaMensaje codigo="404" titulo="No encontramos esta página">
      Puede que el enlace esté mal escrito o que la página ya no exista.
    </PaginaMensaje>
  );
}
