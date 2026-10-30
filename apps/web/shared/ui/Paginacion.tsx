import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { Boton, variantesBoton } from './Boton';

export interface PaginacionProps {
  /** Página actual (desde 1), como la devuelve la API. */
  pagina: number;
  limite: number;
  total: number;
  /** Modo botones: se invoca al cambiar de página. */
  onCambio?: (pagina: number) => void;
  /** Modo enlaces (rastreables, sin JavaScript): URL de cada página. Tiene prioridad sobre `onCambio`. */
  hrefPara?: (pagina: number) => string;
}

export function totalPaginas(total: number, limite: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, limite)));
}

function EnlacePagina({
  href,
  rel,
  children,
}: {
  href: string | null;
  rel: 'prev' | 'next';
  children: ReactNode;
}) {
  const clases = cn(variantesBoton({ variante: 'contorno' }));
  // Sin destino (extremo): sin href, para que no reciba foco ni navegue, pero anunciado como no disponible.
  if (href === null) {
    return (
      <a role="link" aria-disabled="true" className={cn(clases, 'pointer-events-none opacity-60')}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} rel={rel} className={clases}>
      {children}
    </Link>
  );
}

export function Paginacion({ pagina, limite, total, onCambio, hrefPara }: PaginacionProps) {
  const paginas = totalPaginas(total, limite);
  const anterior = (
    <>
      <ChevronLeft className="size-4" aria-hidden="true" />
      Anterior
    </>
  );
  const siguiente = (
    <>
      Siguiente
      <ChevronRight className="size-4" aria-hidden="true" />
    </>
  );
  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-muted-foreground text-sm" aria-current="page">
        Página {pagina} de {paginas} · {total} {total === 1 ? 'resultado' : 'resultados'}
      </p>
      <div className="flex gap-2">
        {hrefPara ? (
          <>
            <EnlacePagina href={pagina > 1 ? hrefPara(pagina - 1) : null} rel="prev">
              {anterior}
            </EnlacePagina>
            <EnlacePagina href={pagina < paginas ? hrefPara(pagina + 1) : null} rel="next">
              {siguiente}
            </EnlacePagina>
          </>
        ) : (
          <>
            <Boton
              variante="contorno"
              disabled={pagina <= 1}
              onClick={() => onCambio?.(pagina - 1)}
            >
              {anterior}
            </Boton>
            <Boton
              variante="contorno"
              disabled={pagina >= paginas}
              onClick={() => onCambio?.(pagina + 1)}
            >
              {siguiente}
            </Boton>
          </>
        )}
      </div>
    </nav>
  );
}
