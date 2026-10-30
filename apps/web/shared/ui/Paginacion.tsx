import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Boton } from './Boton';

export interface PaginacionProps {
  /** Página actual (desde 1), como la devuelve la API. */
  pagina: number;
  limite: number;
  total: number;
  onCambio: (pagina: number) => void;
}

export function totalPaginas(total: number, limite: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, limite)));
}

export function Paginacion({ pagina, limite, total, onCambio }: PaginacionProps) {
  const paginas = totalPaginas(total, limite);
  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-muted-foreground text-sm" aria-current="page">
        Página {pagina} de {paginas} · {total} {total === 1 ? 'resultado' : 'resultados'}
      </p>
      <div className="flex gap-2">
        <Boton variante="contorno" disabled={pagina <= 1} onClick={() => onCambio(pagina - 1)}>
          <ChevronLeft className="size-4" aria-hidden="true" />
          Anterior
        </Boton>
        <Boton
          variante="contorno"
          disabled={pagina >= paginas}
          onClick={() => onCambio(pagina + 1)}
        >
          Siguiente
          <ChevronRight className="size-4" aria-hidden="true" />
        </Boton>
      </div>
    </nav>
  );
}
