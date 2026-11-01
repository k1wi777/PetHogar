'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { mensajeDe } from '@/shared/lib/errores-usuario';
import { AvisoFundacionNoAprobada } from '@/shared/ui/AvisoFundacionNoAprobada';
import { Campo } from '@/shared/ui/Campo';
import { EstadoError } from '@/shared/ui/EstadoError';
import { GuardaFundacionAprobada } from '@/shared/ui/GuardaFundacionAprobada';
import { ESTADOS } from '@/shared/ui/BadgeEstado';
import { Paginacion } from '@/shared/ui/Paginacion';
import { Selector } from '@/shared/ui/Selector';
import { Skeleton } from '@/shared/ui/Skeleton';
import { SOLICITUDES_POR_PAGINA } from '../api/solicitudes';
import { useMascotasParaFiltro, useSolicitudesRecibidas } from '../hooks/useSolicitudesGestion';
import { consultaAUrl, leerConsulta } from '../lib/consulta';
import { esFundacionNoAprobada } from '../lib/errores';
import { ESTADOS_SOLICITUD, type ConsultaSolicitudes, type EstadoSolicitud } from '../types';
import { ListaSolicitudesRecibidas } from './ListaSolicitudesRecibidas';

const TODOS = 'todos';
const OPCIONES_ESTADO = [
  { valor: TODOS, texto: 'Todos los estados' },
  ...ESTADOS_SOLICITUD.map((e) => ({ valor: e, texto: ESTADOS[e]?.texto ?? e })),
];

function Contenido() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const consulta = leerConsulta(params);
  const solicitudes = useSolicitudesRecibidas(consulta);
  const mascotas = useMascotasParaFiltro();

  function ir(siguiente: ConsultaSolicitudes) {
    router.push(`${pathname}${consultaAUrl(siguiente)}`);
  }

  if (solicitudes.isError && esFundacionNoAprobada(solicitudes.error)) {
    return <AvisoFundacionNoAprobada mensajeServidor={mensajeDe(solicitudes.error)} />;
  }

  const lista = mascotas.data?.mascotas ?? [];
  const opcionesMascota = [
    { valor: TODOS, texto: 'Todas las mascotas' },
    ...lista.map((m) => ({ valor: String(m.id), texto: m.nombre })),
  ];
  // Una mascota de la URL que no está entre las 100 del selector se conserva como filtro.
  if (consulta.mascotaId && !lista.some((m) => m.id === consulta.mascotaId)) {
    opcionesMascota.push({
      valor: String(consulta.mascotaId),
      texto: `Mascota #${consulta.mascotaId}`,
    });
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">Solicitudes recibidas</h1>
        <p className="text-muted-foreground">
          Revisa las solicitudes de adopción de tus mascotas y decide si las apruebas o las
          rechazas.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Filtrar por estado">
          <Selector
            opciones={OPCIONES_ESTADO}
            valor={consulta.estado ?? TODOS}
            onCambio={(v) =>
              ir({
                ...consulta,
                pagina: 1,
                estado: v === TODOS ? undefined : (v as EstadoSolicitud),
              })
            }
          />
        </Campo>
        <Campo
          etiqueta="Filtrar por mascota"
          ayuda={
            mascotas.isError
              ? 'No pudimos cargar tus mascotas; puedes seguir usando los demás filtros.'
              : mascotas.data?.hayMas
                ? 'Mostramos tus 100 mascotas más recientes.'
                : undefined
          }
        >
          <Selector
            opciones={opcionesMascota}
            valor={consulta.mascotaId ? String(consulta.mascotaId) : TODOS}
            onCambio={(v) =>
              ir({ ...consulta, pagina: 1, mascotaId: v === TODOS ? undefined : Number(v) })
            }
          />
        </Campo>
      </div>

      <div aria-live="polite" aria-busy={solicitudes.isFetching || undefined}>
        {solicitudes.isPending ? (
          <Skeleton className="h-48" etiqueta="Cargando las solicitudes" />
        ) : solicitudes.isError ? (
          <EstadoError
            error={solicitudes.error}
            alReintentar={() => void solicitudes.refetch()}
            reintentando={solicitudes.isFetching}
          />
        ) : (
          <ListaSolicitudesRecibidas
            solicitudes={solicitudes.data.data}
            consulta={consulta}
            alQuitarFiltros={() => ir({ pagina: 1 })}
          />
        )}
      </div>

      {solicitudes.data && solicitudes.data.total > 0 && (
        <Paginacion
          pagina={solicitudes.data.page}
          limite={solicitudes.data.limit || SOLICITUDES_POR_PAGINA}
          total={solicitudes.data.total}
          onCambio={(pagina) => ir({ ...consulta, pagina })}
        />
      )}
    </div>
  );
}

export function PantallaSolicitudesRecibidas() {
  return (
    <GuardaFundacionAprobada>
      <Contenido />
    </GuardaFundacionAprobada>
  );
}
