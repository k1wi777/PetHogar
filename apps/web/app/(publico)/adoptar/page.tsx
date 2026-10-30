import type { Metadata } from 'next';
import Link from 'next/link';
import { listarEspecies } from '@/features/catalogo/api/especies';
import { listarMascotas } from '@/features/catalogo/api/mascotas';
import { FiltrosCatalogo } from '@/features/catalogo/components/FiltrosCatalogo';
import { ListaMascotas } from '@/features/catalogo/components/ListaMascotas';
import {
  aConsultaApi,
  hayFiltros,
  parsearFiltros,
  urlCatalogo,
  type ParametrosUrl,
} from '@/features/catalogo/lib/consulta';
import type { Especie } from '@/features/catalogo/types';
import { Boton } from '@/shared/ui/Boton';
import { EstadoVacio } from '@/shared/ui/EstadoVacio';
import { Paginacion, totalPaginas } from '@/shared/ui/Paginacion';

export const metadata: Metadata = {
  title: 'Mascotas en adopción',
  description:
    'Conoce a las mascotas disponibles para adopción y filtra por especie, tamaño, edad y ciudad.',
};

// Una caída de /especies no tumba el catálogo: el filtro se muestra deshabilitado.
function especiesOpcionales(): Promise<Especie[] | null> {
  return listarEspecies().catch(() => null);
}

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<ParametrosUrl>;
}) {
  const { filtros: pedidos, rangoInvalido } = parsearFiltros(await searchParams);
  const [primera, especies] = await Promise.all([
    listarMascotas(aConsultaApi(pedidos, rangoInvalido)),
    especiesOpcionales(),
  ]);

  // Página fuera de rango: se muestra la última, con aviso.
  let resultado = primera;
  let filtros = pedidos;
  let avisoPagina: string | null = null;
  const paginas = totalPaginas(primera.total, primera.limit);
  if (primera.total > 0 && pedidos.pagina > paginas) {
    filtros = { ...pedidos, pagina: paginas };
    resultado = await listarMascotas(aConsultaApi(filtros, rangoInvalido));
    avisoPagina = `La página ${pedidos.pagina} no existe; te mostramos la última.`;
  }

  const { data, total } = resultado;
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <h1 className="text-3xl">Mascotas disponibles</h1>
      <FiltrosCatalogo filtros={filtros} especies={especies} errorRango={rangoInvalido} />
      <div role="status">
        <p className="font-semibold">
          {total === 1 ? '1 mascota encontrada' : `${total} mascotas encontradas`}
        </p>
        {avisoPagina && <p className="text-muted-foreground text-sm">{avisoPagina}</p>}
      </div>
      {data.length === 0 ? (
        <EstadoVacio
          titulo="No hay mascotas con esos criterios"
          descripcion={
            hayFiltros(filtros)
              ? 'Prueba ampliar la búsqueda: quita algún filtro o ensancha el rango de edad.'
              : 'Por ahora no hay mascotas disponibles. Vuelve pronto.'
          }
          accion={
            hayFiltros(filtros) ? (
              <Boton comoHijo variante="contorno">
                <Link href="/adoptar">Limpiar filtros</Link>
              </Boton>
            ) : undefined
          }
        />
      ) : (
        <ListaMascotas mascotas={data} />
      )}
      {paginas > 1 && (
        <Paginacion
          pagina={resultado.page}
          limite={resultado.limit}
          total={total}
          hrefPara={(n) => urlCatalogo(filtros, n)}
        />
      )}
    </div>
  );
}
