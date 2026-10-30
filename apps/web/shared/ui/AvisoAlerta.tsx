'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Aviso de error de una pantalla o formulario: se anuncia (`role="alert"`) y recibe el foco al aparecer. */
export function AvisoAlerta({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [children]);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="border-destructive text-foreground bg-card flex flex-col gap-2 rounded-md border-2 p-3 text-base focus:outline-2"
    >
      <p>{children}</p>
      {accion}
    </div>
  );
}
