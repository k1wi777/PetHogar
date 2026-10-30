'use client';

import Link from 'next/link';
import { useSesion } from '@/shared/auth/SesionProvider';
import { formatearFechaBogota } from '@/shared/lib/fechas';
import { cn } from '@/shared/lib/utils';
import { useMarcarLeida } from '../hooks/useNotificaciones';
import { destinoDe, listaDelPanel } from '../lib/destino';
import type { Notificacion } from '../types';

const CLASES =
  'hover:bg-muted focus-visible:ring-ring flex w-full items-start gap-3 rounded-md p-3 text-left focus-visible:ring-2 focus-visible:outline-none';

/**
 * Una notificación: un único elemento interactivo que la marca como leída y lleva a su pantalla
 * sin esperar al servidor (si marcar falla se avisa, pero nunca se impide llegar al destino).
 * Título y mensaje son texto plano del backend: se muestran escapados, nunca como HTML.
 * Leída o no se distingue con texto («Nueva»), forma (círculo lleno o vacío) y peso del título.
 */
export function ItemNotificacion({
  notificacion,
  alAbrir,
}: {
  notificacion: Notificacion;
  /** Se llama al activar el elemento (p. ej. para cerrar el menú de la campana). */
  alAbrir?: () => void;
}) {
  const { usuario } = useSesion();
  const marcar = useMarcarLeida();
  const rol = usuario?.rol;
  const destino = rol ? destinoDe(notificacion, rol) : null;
  // Si el destino es la propia lista no hay a dónde ir: solo se marca.
  const navega = destino !== null && rol !== undefined && destino !== listaDelPanel(rol);

  function abrir() {
    if (!notificacion.leida) {
      marcar.mutate({ id: notificacion.id, leida: false });
    }
    alAbrir?.();
  }

  const contenido = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'mt-1.5 size-3 shrink-0 rounded-full border-2',
          notificacion.leida ? 'border-border bg-transparent' : 'border-primary bg-primary',
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="sr-only">{notificacion.leida ? 'Leída. ' : 'No leída. '}</span>
        <span className={cn('block break-words', notificacion.leida ? 'font-medium' : 'font-bold')}>
          {notificacion.titulo}
        </span>
        <span className="text-muted-foreground block text-sm break-words">
          {notificacion.mensaje}
        </span>
        <span className="text-muted-foreground block text-xs">
          {formatearFechaBogota(notificacion.fechaCreacion)}
        </span>
      </span>
      {!notificacion.leida && (
        <span
          aria-hidden="true"
          className="bg-primary text-primary-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-bold"
        >
          Nueva
        </span>
      )}
    </>
  );

  return navega ? (
    <Link href={destino} onClick={abrir} className={CLASES}>
      {contenido}
    </Link>
  ) : (
    <button type="button" onClick={abrir} className={CLASES}>
      {contenido}
    </button>
  );
}
