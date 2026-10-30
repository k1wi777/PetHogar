import Link from 'next/link';
import { Boton } from '@/shared/ui/Boton';
import { hayFiltros, TAMANOS } from '../lib/consulta';
import { etiquetaTamano } from '../lib/formato';
import type { Especie, FiltrosCatalogo as Filtros } from '../types';

const CONTROL =
  'bg-card border-border min-h-11 w-full rounded-md border px-3 py-2 text-base disabled:opacity-60';

function mayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Filtros del catálogo: un formulario GET con controles nativos. La URL es la única fuente de verdad,
 * así que funciona sin JavaScript y compartir el enlace reproduce el resultado. Al enviarlo no se
 * incluye `pagina`, por lo que la búsqueda vuelve a la página 1.
 */
export function FiltrosCatalogo({
  filtros,
  especies,
  errorRango,
}: {
  filtros: Filtros;
  /** `null` si no se pudieron cargar: el filtro de especie queda deshabilitado. */
  especies: Especie[] | null;
  errorRango?: boolean;
}) {
  return (
    <form
      method="get"
      action="/adoptar"
      aria-label="Filtrar mascotas"
      className="bg-card border-border-suave grid gap-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="filtro-especie" className="text-base font-semibold">
          Especie
        </label>
        <select
          id="filtro-especie"
          name="especie"
          defaultValue={filtros.especie?.toString() ?? ''}
          disabled={especies === null}
          aria-describedby={especies === null ? 'filtro-especie-nota' : undefined}
          className={CONTROL}
        >
          <option value="">Todas</option>
          {especies?.map((e) => (
            <option key={e.id} value={e.id}>
              {mayuscula(e.nombre)}
            </option>
          ))}
        </select>
        {especies === null && (
          <p id="filtro-especie-nota" className="text-muted-foreground text-sm">
            No pudimos cargar las especies; puedes seguir buscando con los demás filtros.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="filtro-tamano" className="text-base font-semibold">
          Tamaño
        </label>
        <select
          id="filtro-tamano"
          name="tamano"
          defaultValue={filtros.tamano ?? ''}
          className={CONTROL}
        >
          <option value="">Todos</option>
          {TAMANOS.map((t) => (
            <option key={t} value={t}>
              {etiquetaTamano(t)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="filtro-ciudad" className="text-base font-semibold">
          Ciudad
        </label>
        <input
          id="filtro-ciudad"
          name="ciudad"
          type="text"
          maxLength={60}
          defaultValue={filtros.ciudad ?? ''}
          className={CONTROL}
        />
      </div>
      <fieldset className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
        <legend className="text-base font-semibold">Rango de edad (en meses)</legend>
        <div className="flex gap-2">
          <div className="flex-1">
            <label htmlFor="filtro-edad-min" className="text-muted-foreground text-sm">
              Desde
            </label>
            <input
              id="filtro-edad-min"
              name="edadMin"
              type="number"
              min={0}
              max={360}
              inputMode="numeric"
              defaultValue={filtros.edadMin?.toString() ?? ''}
              aria-invalid={errorRango || undefined}
              className={CONTROL}
            />
          </div>
          <div className="flex-1">
            <label htmlFor="filtro-edad-max" className="text-muted-foreground text-sm">
              Hasta
            </label>
            <input
              id="filtro-edad-max"
              name="edadMax"
              type="number"
              min={0}
              max={360}
              inputMode="numeric"
              defaultValue={filtros.edadMax?.toString() ?? ''}
              aria-invalid={errorRango || undefined}
              className={CONTROL}
            />
          </div>
        </div>
        {errorRango && (
          <p role="alert" className="text-destructive text-sm font-medium">
            La edad mínima no puede ser mayor que la máxima.
          </p>
        )}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
        <Boton type="submit">Buscar</Boton>
        {hayFiltros(filtros) && (
          <Link
            href="/adoptar"
            className="hover:bg-muted inline-flex min-h-11 items-center rounded-md px-3 font-semibold underline"
          >
            Limpiar filtros
          </Link>
        )}
      </div>
    </form>
  );
}
