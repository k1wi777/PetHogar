'use client';

import { Heart } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { mensajeDe } from '@/shared/api/errores';
import { AvisoFundacionNoAprobada } from '@/shared/ui/AvisoFundacionNoAprobada';
import { ESTADOS } from '@/shared/ui/BadgeEstado';
import { Boton } from '@/shared/ui/Boton';
import { Campo } from '@/shared/ui/Campo';
import { EstadoError } from '@/shared/ui/EstadoError';
import { EstadoVacio } from '@/shared/ui/EstadoVacio';
import { GuardaFundacionAprobada } from '@/shared/ui/GuardaFundacionAprobada';
import { Paginacion } from '@/shared/ui/Paginacion';
import { Selector } from '@/shared/ui/Selector';
import { Skeleton } from '@/shared/ui/Skeleton';
import { ADOPCIONES_POR_PAGINA } from '../api/adopciones';
import { useAdopciones } from '../hooks/useAdopcionesGestion';
import { consultaAUrl, leerConsulta } from '../lib/consulta';
import { esFundacionNoAprobada } from '../lib/errores';
import { ESTADOS_ADOPCION, type ConsultaAdopciones, type EstadoAdopcion } from '../types';
import { TarjetaAdopcion } from './TarjetaAdopcion';

const TODOS = 'todos';
const OPCIONES = [
  { valor: TODOS, texto: 'Todas' },
  ...ESTADOS_ADOPCION.map((e) => ({ valor: e, texto: ESTADOS[e]?.texto ?? e })),
];

function Contenido() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const consulta = leerConsulta(params);
  const adopciones = useAdopciones(consulta);
  // Solo un panel de «Programar» abierto a la vez; `foco` marca el seguimiento recién creado.
  const [abierta, setAbierta] = useState<number | null>(null);
  const [foco, setFoco] = useState<{ adopcionId: number; seguimientoId: number } | null>(null);
  const [anuncio, setAnuncio] = useState('');

  function ir(siguiente: ConsultaAdopciones) {
    setAbierta(null);
    router.push(`${pathname}${consultaAUrl(siguiente)}`);
  }

  if (adopciones.isError && esFundacionNoAprobada(adopciones.error)) {
    return <AvisoFundacionNoAprobada mensajeServidor={mensajeDe(adopciones.error)} />;
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">Adopciones y seguimientos</h1>
        <p className="text-muted-foreground">
          Consulta tus adopciones, programa seguimientos y registra cómo está cada mascota.
        </p>
      </div>

      <div className="max-w-xs">
        <Campo etiqueta="Filtrar por estado">
          <Selector
            opciones={OPCIONES}
            valor={consulta.estado ?? TODOS}
            onCambio={(v) =>
              ir({ pagina: 1, estado: v === TODOS ? undefined : (v as EstadoAdopcion) })
            }
          />
        </Campo>
      </div>

      <p
        role="status"
        className={
          anuncio
            ? 'text-success-foreground bg-success rounded-md px-3 py-2 font-semibold'
            : 'sr-only'
        }
      >
        {anuncio}
      </p>

      <div aria-live="polite" aria-busy={adopciones.isFetching || undefined}>
        {adopciones.isPending ? (
          <Skeleton className="h-48" etiqueta="Cargando las adopciones" />
        ) : adopciones.isError ? (
          <EstadoError
            alReintentar={() => void adopciones.refetch()}
            reintentando={adopciones.isFetching}
          />
        ) : adopciones.data.data.length === 0 ? (
          consulta.estado ? (
            <EstadoVacio
              titulo="No hay adopciones con ese estado"
              descripcion="Prueba con otro estado o muestra todas las adopciones."
              accion={
                <Boton variante="contorno" onClick={() => ir({ pagina: 1 })}>
                  Ver todas
                </Boton>
              }
            />
          ) : (
            <EstadoVacio
              icono={Heart}
              titulo="Aún no tienes adopciones"
              descripcion="Cuando apruebes una solicitud, la adopción aparecerá aquí para que programes sus seguimientos."
            />
          )
        ) : (
          <ul className="flex flex-col gap-4" aria-label="Adopciones">
            {adopciones.data.data.map((a) => (
              <li key={a.id}>
                <TarjetaAdopcion
                  adopcion={a}
                  panelAbierto={abierta === a.id}
                  alAbrirPanel={() => setAbierta(a.id)}
                  alCerrarPanel={(devolverFoco) => {
                    if (!devolverFoco) setFoco(null);
                    setAbierta(null);
                  }}
                  foco={foco?.adopcionId === a.id ? foco.seguimientoId : null}
                  alFocoAplicado={() => setFoco(null)}
                  alProgramado={(s) => {
                    setAbierta(null);
                    setFoco({ adopcionId: a.id, seguimientoId: s.id });
                    setAnuncio(`Seguimiento programado para ${a.mascota.nombre}.`);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {adopciones.data && adopciones.data.total > 0 && (
        <Paginacion
          pagina={adopciones.data.page}
          limite={adopciones.data.limit || ADOPCIONES_POR_PAGINA}
          total={adopciones.data.total}
          onCambio={(pagina) => ir({ ...consulta, pagina })}
        />
      )}
    </div>
  );
}

export function PantallaAdopciones() {
  return (
    <GuardaFundacionAprobada>
      <Contenido />
    </GuardaFundacionAprobada>
  );
}
