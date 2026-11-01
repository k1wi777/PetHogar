'use client';

import { FileText } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BadgeEstado, ESTADOS } from '@/shared/ui/BadgeEstado';
import { Boton } from '@/shared/ui/Boton';
import { Campo } from '@/shared/ui/Campo';
import { EstadoError } from '@/shared/ui/EstadoError';
import { EstadoVacio } from '@/shared/ui/EstadoVacio';
import { Paginacion } from '@/shared/ui/Paginacion';
import { Selector } from '@/shared/ui/Selector';
import { Skeleton } from '@/shared/ui/Skeleton';
import { formatearFecha } from '@/shared/lib/fechas';
import { useMisSolicitudes } from '../hooks/useSolicitudes';
import { consultaAUrl, leerConsulta, rutaDetalle } from '../lib/consulta';
import { SOLICITUDES_POR_PAGINA } from '../api/solicitudes';
import { ESTADOS_SOLICITUD, type EstadoSolicitud } from '../types';

const TODOS = 'todos';
const OPCIONES = [
  { valor: TODOS, texto: 'Todos los estados' },
  ...ESTADOS_SOLICITUD.map((e) => ({ valor: e, texto: ESTADOS[e]?.texto ?? e })),
];

/** Mis solicitudes: filtro y página viven en la URL para sobrevivir a la ida y vuelta al detalle (R8). */
export function ListaSolicitudes() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const consulta = leerConsulta(params);
  const solicitudes = useMisSolicitudes(consulta);

  function ir(siguiente: { pagina: number; estado?: EstadoSolicitud }) {
    router.push(`${pathname}${consultaAUrl(siguiente)}`);
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">Mis solicitudes</h1>
        <p className="text-muted-foreground">
          Aquí ves cómo va cada solicitud de adopción que enviaste.
        </p>
      </div>

      <div className="max-w-xs">
        <Campo etiqueta="Filtrar por estado">
          <Selector
            opciones={OPCIONES}
            valor={consulta.estado ?? TODOS}
            onCambio={(v) =>
              ir({ pagina: 1, estado: v === TODOS ? undefined : (v as EstadoSolicitud) })
            }
          />
        </Campo>
      </div>

      <div aria-live="polite" aria-busy={solicitudes.isFetching || undefined}>
        {solicitudes.isPending ? (
          <Skeleton className="h-48" etiqueta="Cargando tus solicitudes" />
        ) : solicitudes.isError ? (
          <EstadoError
            error={solicitudes.error}
            alReintentar={() => void solicitudes.refetch()}
            reintentando={solicitudes.isFetching}
          />
        ) : solicitudes.data.data.length === 0 ? (
          consulta.estado ? (
            <EstadoVacio
              titulo="No hay solicitudes con ese estado"
              descripcion="Prueba con otro estado o muestra todas tus solicitudes."
              accion={
                <Boton variante="contorno" onClick={() => ir({ pagina: 1 })}>
                  Ver todas
                </Boton>
              }
            />
          ) : (
            <EstadoVacio
              icono={FileText}
              titulo="Aún no has enviado solicitudes"
              descripcion="Cuando quieras adoptar, abre la ficha de una mascota y pulsa «Quiero adoptar»."
              accion={
                <Boton comoHijo>
                  <Link href="/adoptar">Ver mascotas en adopción</Link>
                </Boton>
              }
            />
          )
        ) : (
          <ul className="flex flex-col gap-3" aria-label="Solicitudes">
            {solicitudes.data.data.map((s) => (
              <li
                key={s.id}
                className="border-border-suave bg-card flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-1">
                  <p className="text-lg font-bold">{s.mascota.nombre}</p>
                  <p className="text-muted-foreground text-sm">
                    {s.fundacion.nombre} · Enviada el {formatearFecha(s.fechaSolicitud)}
                  </p>
                  <p>
                    <span className="sr-only">Estado: </span>
                    <BadgeEstado estado={s.estado} />
                  </p>
                </div>
                <Boton comoHijo variante="contorno">
                  <Link
                    href={rutaDetalle(s.id, consulta)}
                    aria-label={`Ver detalle de la solicitud para ${s.mascota.nombre}`}
                  >
                    Ver detalle
                  </Link>
                </Boton>
              </li>
            ))}
          </ul>
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
