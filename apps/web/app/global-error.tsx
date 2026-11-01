'use client';

import './globals.css';

/**
 * Último recurso: solo se muestra si falla el layout raíz. Debe traer su propio `<html>` y no
 * depender de providers ni de fuentes.
 */
export default function ErrorGlobal({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body>
        <main
          id="contenido"
          className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-16 text-center"
        >
          <h1 className="text-3xl font-bold">Algo salió mal</h1>
          <p>
            Tuvimos un problema inesperado al cargar PetHogar. Inténtalo de nuevo; si continúa,
            vuelve más tarde.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="bg-primary text-primary-foreground min-h-11 rounded-md px-4 py-2 text-base font-semibold"
            >
              Reintentar
            </button>
            {/* Recarga completa a propósito: el layout raíz falló y no hay router fiable. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="border-border bg-card text-foreground min-h-11 rounded-md border px-4 py-2 text-base font-semibold"
            >
              Ir al inicio
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
