'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { EstadoError } from '@/shared/ui/EstadoError';
import { ESTADOS } from '@/shared/ui/BadgeEstado';
import { Campo } from '@/shared/ui/Campo';
import { Paginacion } from '@/shared/ui/Paginacion';
import { Selector } from '@/shared/ui/Selector';
import { Skeleton } from '@/shared/ui/Skeleton';
import { FUNDACIONES_POR_PAGINA } from '../api/fundaciones';
import { useFundaciones } from '../hooks/useAdminFundaciones';
import { consultaAUrl, leerConsulta } from '../lib/consulta';
import { ESTADOS_VALIDACION, type ConsultaFundaciones, type EstadoValidacion } from '../types';
import { ListaFundaciones } from './ListaFundaciones';

const OPCIONES_ESTADO = ESTADOS_VALIDACION.map((e) => ({
  valor: e,
  texto: ESTADOS[e]?.texto ?? e,
}));

/** «Fundaciones por validar»: pendientes por defecto; el backend solo filtra por estado. */
export function PantallaFundaciones() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const consulta = leerConsulta(params);
  const fundaciones = useFundaciones(consulta);

  function ir(siguiente: ConsultaFundaciones) {
    router.push(`${pathname}${consultaAUrl(siguiente)}`);
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">Fundaciones por validar</h1>
        <p className="text-muted-foreground">
          Revisa los datos y el documento legal de cada fundación antes de aprobarla o rechazarla.
        </p>
      </div>

      <div className="sm:max-w-xs">
        <Campo etiqueta="Filtrar por estado">
          <Selector
            opciones={OPCIONES_ESTADO}
            valor={consulta.estado}
            onCambio={(v) => ir({ pagina: 1, estado: v as EstadoValidacion })}
          />
        </Campo>
      </div>

      <div aria-live="polite" aria-busy={fundaciones.isFetching || undefined}>
        {fundaciones.isPending ? (
          <Skeleton className="h-48" etiqueta="Cargando las fundaciones" />
        ) : fundaciones.isError ? (
          <EstadoError
            alReintentar={() => void fundaciones.refetch()}
            reintentando={fundaciones.isFetching}
          />
        ) : (
          <ListaFundaciones fundaciones={fundaciones.data.data} consulta={consulta} />
        )}
      </div>

      {fundaciones.data && fundaciones.data.total > 0 && (
        <Paginacion
          pagina={fundaciones.data.page}
          limite={fundaciones.data.limit || FUNDACIONES_POR_PAGINA}
          total={fundaciones.data.total}
          onCambio={(pagina) => ir({ ...consulta, pagina })}
        />
      )}
    </div>
  );
}
