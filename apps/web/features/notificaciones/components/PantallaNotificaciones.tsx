'use client';

import { Bell } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { Boton } from '@/shared/ui/Boton';
import { Campo } from '@/shared/ui/Campo';
import { EstadoError } from '@/shared/ui/EstadoError';
import { EstadoVacio } from '@/shared/ui/EstadoVacio';
import { Paginacion, totalPaginas } from '@/shared/ui/Paginacion';
import { Selector } from '@/shared/ui/Selector';
import { Skeleton } from '@/shared/ui/Skeleton';
import { NOTIFICACIONES_POR_PAGINA } from '../api/notificaciones';
import { useNoLeidasEnCache } from '../hooks/useNoLeidas';
import { useListaNotificaciones } from '../hooks/useNotificaciones';
import { consultaAUrl, leerConsulta } from '../lib/consulta';
import type { ConsultaNotificaciones, FiltroLeida } from '../types';
import { ItemNotificacion } from './ItemNotificacion';
import { MarcarTodas } from './MarcarTodas';

const OPCIONES: ReadonlyArray<{ valor: FiltroLeida; texto: string }> = [
  { valor: 'todas', texto: 'Todas' },
  { valor: 'no-leidas', texto: 'No leídas' },
  { valor: 'leidas', texto: 'Leídas' },
];

const VACIO: Readonly<Record<FiltroLeida, { titulo: string; descripcion: string }>> = {
  todas: {
    titulo: 'Todavía no tienes notificaciones',
    descripcion: 'Cuando haya novedades sobre tu actividad, las verás aquí.',
  },
  'no-leidas': {
    titulo: 'No tienes notificaciones sin leer',
    descripcion: 'Estás al día. Puedes revisar también las que ya leíste.',
  },
  leidas: {
    titulo: 'No tienes notificaciones leídas',
    descripcion: 'Las que abras o marques como leídas aparecerán aquí.',
  },
};

/** Lista completa y paginada de notificaciones del usuario, con filtro en la URL. */
export function PantallaNotificaciones() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const consulta = leerConsulta(params);
  const lista = useListaNotificaciones(consulta);
  const sinLeer = useNoLeidasEnCache();

  function ir(siguiente: ConsultaNotificaciones) {
    router.push(`${pathname}${consultaAUrl(siguiente)}`);
  }

  // Si tras marcar la página consultada queda vacía (p. ej. la última de «No leídas»), se retrocede.
  const datos = lista.data;
  const fueraDeRango =
    datos !== undefined &&
    !lista.isPlaceholderData &&
    datos.data.length === 0 &&
    consulta.pagina > 1;
  useEffect(() => {
    if (!fueraDeRango || !datos) return;
    const ultima = Math.min(
      consulta.pagina - 1,
      totalPaginas(datos.total, datos.limit || NOTIFICACIONES_POR_PAGINA),
    );
    router.replace(`${pathname}${consultaAUrl({ ...consulta, pagina: Math.max(1, ultima) })}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia el rango
  }, [fueraDeRango]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">Notificaciones</h1>
        <p className="text-muted-foreground">
          Aquí aparecen los avisos sobre tus solicitudes, adopciones y seguimientos.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <Campo etiqueta="Mostrar">
            <Selector
              opciones={OPCIONES}
              valor={consulta.filtro}
              onCambio={(v) => ir({ pagina: 1, filtro: v as FiltroLeida })}
            />
          </Campo>
        </div>
        <MarcarTodas deshabilitado={sinLeer.data === 0} />
      </div>

      <div aria-live="polite" aria-busy={lista.isFetching || undefined}>
        {lista.isPending ? (
          <Skeleton className="h-48" etiqueta="Cargando las notificaciones" />
        ) : lista.isError ? (
          <EstadoError
            error={lista.error}
            titulo="No pudimos cargar tus notificaciones"
            alReintentar={() => void lista.refetch()}
            reintentando={lista.isFetching}
          />
        ) : lista.data.data.length === 0 ? (
          <EstadoVacio
            icono={Bell}
            titulo={VACIO[consulta.filtro].titulo}
            descripcion={VACIO[consulta.filtro].descripcion}
            accion={
              consulta.filtro !== 'todas' ? (
                <Boton variante="contorno" onClick={() => ir({ pagina: 1, filtro: 'todas' })}>
                  Ver todas
                </Boton>
              ) : undefined
            }
          />
        ) : (
          <ul
            className="border-border-suave bg-card divide-border-suave divide-y rounded-lg border"
            aria-label="Notificaciones"
          >
            {lista.data.data.map((n) => (
              <li key={n.id}>
                <ItemNotificacion notificacion={n} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {lista.data && lista.data.total > 0 && (
        <Paginacion
          pagina={lista.data.page}
          limite={lista.data.limit || NOTIFICACIONES_POR_PAGINA}
          total={lista.data.total}
          onCambio={(pagina) => ir({ ...consulta, pagina })}
        />
      )}
    </div>
  );
}
