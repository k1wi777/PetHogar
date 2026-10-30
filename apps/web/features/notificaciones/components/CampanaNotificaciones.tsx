'use client';

import { Bell } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useNoLeidas } from '../hooks/useNoLeidas';
import { AnuncioContador } from './AnuncioContador';
import { MenuNotificaciones } from './MenuNotificaciones';

export const TOPE_VISIBLE = 99;

export function etiquetaNotificaciones(cantidad: number | undefined): string {
  if (cantidad === undefined) return 'Notificaciones';
  if (cantidad === 0) return 'Notificaciones, ninguna sin leer';
  return `Notificaciones, ${cantidad} sin leer`;
}

/**
 * Campana con contador y menú desplegable (patrón disclosure, no `role="menu"`): el botón abre
 * un panel informativo no modal. Al abrir el foco pasa al título del panel; Escape lo cierra y
 * devuelve el foco a la campana; el clic o el foco fuera lo cierran sin robar el foco.
 * Si el contador falla se muestra sin cifra. `href` es la lista completa del panel.
 */
export function CampanaNotificaciones({ href }: { href: string }) {
  const { data } = useNoLeidas();
  const [abierto, setAbierto] = useState(false);
  const idPanel = useId();
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (abierto) titulo.current?.focus();
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    function alPulsar(e: PointerEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener('pointerdown', alPulsar);
    return () => document.removeEventListener('pointerdown', alPulsar);
  }, [abierto]);

  function alTeclear(e: KeyboardEvent) {
    if (e.key === 'Escape' && abierto) {
      e.stopPropagation();
      setAbierto(false);
      boton.current?.focus();
    }
  }

  return (
    <div
      ref={contenedor}
      onKeyDown={alTeclear}
      onBlur={(e) => {
        const siguiente = e.relatedTarget as Node | null;
        if (abierto && siguiente && !contenedor.current?.contains(siguiente)) setAbierto(false);
      }}
    >
      <button
        ref={boton}
        type="button"
        aria-label={etiquetaNotificaciones(data)}
        aria-expanded={abierto}
        aria-controls={abierto ? idPanel : undefined}
        onClick={() => setAbierto((a) => !a)}
        className="hover:bg-muted relative inline-flex size-11 items-center justify-center rounded-md"
      >
        <Bell className="size-6" aria-hidden="true" />
        {data !== undefined && data > 0 && (
          <span
            aria-hidden="true"
            className="bg-destructive text-destructive-foreground absolute top-0.5 right-0.5 min-w-5 rounded-full px-1 text-center text-xs font-bold"
          >
            {data > TOPE_VISIBLE ? `${TOPE_VISIBLE}+` : data}
          </span>
        )}
      </button>
      <AnuncioContador cantidad={data} />
      {abierto && (
        <MenuNotificaciones
          id={idPanel}
          hrefLista={href}
          sinLeer={data}
          refTitulo={titulo}
          alCerrar={() => setAbierto(false)}
        />
      )}
    </div>
  );
}
