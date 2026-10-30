import Link from 'next/link';
import type { ReactNode } from 'react';
import { Boton } from './Boton';

/** Página de mensaje (403, 404, error) con un enlace de salida. */
export function PaginaMensaje({
  codigo,
  titulo,
  children,
  accion,
}: {
  codigo?: string;
  titulo: string;
  children: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-16 text-center">
      {codigo && (
        <p aria-hidden="true" className="font-heading text-primary text-6xl font-extrabold">
          {codigo}
        </p>
      )}
      <h1 className="text-3xl">{titulo}</h1>
      <p className="text-muted-foreground">{children}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {accion}
        <Boton comoHijo variante={accion ? 'contorno' : 'primario'}>
          <Link href="/">Ir al inicio</Link>
        </Boton>
      </div>
    </div>
  );
}

export function SinPermiso() {
  return (
    <PaginaMensaje codigo="403" titulo="No tienes permiso para ver esta página">
      Tu cuenta no puede entrar a esta sección. Si crees que es un error, vuelve al inicio e ingresa
      con la cuenta correcta.
    </PaginaMensaje>
  );
}
