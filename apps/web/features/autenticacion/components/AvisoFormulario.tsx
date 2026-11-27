'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Aviso general de un formulario: se anuncia (`role="alert"`) y recibe el foco al aparecer. */
export function AvisoFormulario({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [children]);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="border-destructive text-foreground bg-card flex flex-col gap-2 rounded-lg border-2 p-4 text-base focus:outline-2"
    >
      <p>{children}</p>
      {accion}
    </div>
  );
}
