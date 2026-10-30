'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { esErrorApi, mensajeDe } from '@/shared/api/errores';
import { AvisoFundacionNoAprobada } from '@/shared/ui/AvisoFundacionNoAprobada';
import { Boton } from '@/shared/ui/Boton';
import { EstadoError } from '@/shared/ui/EstadoError';
import { GuardaFundacionAprobada } from '@/shared/ui/GuardaFundacionAprobada';
import { Paginacion } from '@/shared/ui/Paginacion';
import { Skeleton } from '@/shared/ui/Skeleton';
import { DONACIONES_POR_PAGINA } from '../api/donaciones';
import { useDonacionesFundacion } from '../hooks/useDonacionesGestion';
import { RUTA_NUEVA_DONACION, consultaAUrl, leerConsulta } from '../lib/consulta';
import type { ConsultaDonaciones } from '../types';
import { AvisoSinPagos } from './AvisoSinPagos';
import { FiltroDonaciones } from './FiltroDonaciones';
import { ListaDonacionesFundacion } from './ListaDonacionesFundacion';
import { TotalesDonaciones } from './TotalesDonaciones';

function Contenido() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const consulta = leerConsulta(params);
  const donaciones = useDonacionesFundacion(consulta);
  const registrado = params.get('registrado') === '1';
  const titulo = useRef<HTMLHeadingElement>(null);
  // Al volver del registro manual, el foco va al encabezado (el formulario ya no existe).
  useEffect(() => {
    if (registrado) titulo.current?.focus();
  }, [registrado]);

  function ir(siguiente: ConsultaDonaciones) {
    router.push(`${pathname}${consultaAUrl(siguiente)}`);
  }

  if (donaciones.isError && esErrorApi(donaciones.error) && donaciones.error.estado === 403) {
    return <AvisoFundacionNoAprobada mensajeServidor={mensajeDe(donaciones.error)} />;
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 ref={titulo} tabIndex={-1} className="text-3xl focus:outline-2">
            Donaciones
          </h1>
          <p className="text-muted-foreground">
            Consulta los aportes que recibe tu fundación y registra los que llegan en persona.
          </p>
        </div>
        <Boton comoHijo className="w-full sm:w-auto">
          <Link href={RUTA_NUEVA_DONACION}>Registrar aporte</Link>
        </Boton>
      </div>

      <AvisoSinPagos />

      {registrado && (
        <p role="status" className="border-success bg-card rounded-md border-2 p-3">
          Aporte registrado. Si no lo ves en la lista, revisa el periodo y el tipo del filtro.
        </p>
      )}

      <FiltroDonaciones
        key={consultaAUrl({ ...consulta, pagina: 1 })}
        consulta={consulta}
        alAplicar={ir}
      />

      <div
        aria-live="polite"
        aria-busy={donaciones.isFetching || undefined}
        className="flex flex-col gap-6"
      >
        {donaciones.isPending ? (
          <Skeleton className="h-48" etiqueta="Cargando las donaciones" />
        ) : donaciones.isError ? (
          <EstadoError
            alReintentar={() => void donaciones.refetch()}
            reintentando={donaciones.isFetching}
          />
        ) : (
          <>
            <TotalesDonaciones totales={donaciones.data.totales} />
            <section aria-labelledby="titulo-aportes" className="flex flex-col gap-3">
              <h2 id="titulo-aportes" className="text-2xl">
                Aportes
              </h2>
              <ListaDonacionesFundacion
                donaciones={donaciones.data.data}
                consulta={consulta}
                alQuitarFiltros={() => ir({ pagina: 1 })}
              />
            </section>
          </>
        )}
      </div>

      {donaciones.data && donaciones.data.total > 0 && (
        <Paginacion
          pagina={donaciones.data.page}
          limite={donaciones.data.limit || DONACIONES_POR_PAGINA}
          total={donaciones.data.total}
          onCambio={(pagina) => ir({ ...consulta, pagina })}
        />
      )}
    </div>
  );
}

export function PantallaDonacionesFundacion() {
  return (
    <GuardaFundacionAprobada>
      <Contenido />
    </GuardaFundacionAprobada>
  );
}
