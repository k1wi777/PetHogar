'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Boton } from '@/shared/ui/Boton';
import { EstadoError } from '@/shared/ui/EstadoError';
import { Paginacion } from '@/shared/ui/Paginacion';
import { Skeleton } from '@/shared/ui/Skeleton';
import { MASCOTAS_POR_PAGINA } from '../api/mascotas';
import { useMisMascotas } from '../hooks/useMascotasGestion';
import { consultaAUrl, leerConsulta, RUTA_MASCOTAS } from '../lib/consulta';
import { esFundacionNoAprobada } from '../lib/errores';
import { mensajeDe } from '@/shared/lib/errores-usuario';
import type { EstadoMascota } from '../types';
import { AvisoFundacionNoAprobada } from '@/shared/ui/AvisoFundacionNoAprobada';
import { FiltroEstado } from './FiltroEstado';
import { GuardaFundacionAprobada } from '@/shared/ui/GuardaFundacionAprobada';
import { ListaMascotas } from './ListaMascotas';

function Contenido() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const consulta = leerConsulta(params);
  const mascotas = useMisMascotas(consulta);

  function ir(siguiente: { pagina: number; estado?: EstadoMascota }) {
    router.push(`${pathname}${consultaAUrl(siguiente)}`);
  }

  if (mascotas.isError && esFundacionNoAprobada(mascotas.error)) {
    return <AvisoFundacionNoAprobada mensajeServidor={mensajeDe(mascotas.error)} />;
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl">Mis mascotas</h1>
          <p className="text-muted-foreground">Publica y gestiona las mascotas de tu fundación.</p>
        </div>
        <Boton comoHijo>
          <Link href={`${RUTA_MASCOTAS}/nueva`}>Publicar mascota</Link>
        </Boton>
      </div>

      <FiltroEstado valor={consulta.estado} onCambio={(estado) => ir({ pagina: 1, estado })} />

      <div aria-live="polite" aria-busy={mascotas.isFetching || undefined}>
        {mascotas.isPending ? (
          <Skeleton className="h-48" etiqueta="Cargando tus mascotas" />
        ) : mascotas.isError ? (
          <EstadoError
            error={mascotas.error}
            alReintentar={() => void mascotas.refetch()}
            reintentando={mascotas.isFetching}
          />
        ) : (
          <ListaMascotas
            mascotas={mascotas.data.data}
            consulta={consulta}
            alVerTodas={() => ir({ pagina: 1 })}
          />
        )}
      </div>

      {mascotas.data && mascotas.data.total > 0 && (
        <Paginacion
          pagina={mascotas.data.page}
          limite={mascotas.data.limit || MASCOTAS_POR_PAGINA}
          total={mascotas.data.total}
          onCambio={(pagina) => ir({ ...consulta, pagina })}
        />
      )}
    </div>
  );
}

export function PantallaMisMascotas() {
  return (
    <GuardaFundacionAprobada>
      <Contenido />
    </GuardaFundacionAprobada>
  );
}
