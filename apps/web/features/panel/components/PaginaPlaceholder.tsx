import { EstadoVacio } from '@/shared/ui/EstadoVacio';

/** Contenido provisional de las opciones de menú cuyas pantallas llegan en Features posteriores. */
export function PaginaPlaceholder({
  titulo,
  descripcion,
}: {
  titulo: string;
  descripcion: string;
}) {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-3xl">{titulo}</h1>
      <EstadoVacio titulo="Esta sección estará disponible próximamente" descripcion={descripcion} />
    </div>
  );
}
