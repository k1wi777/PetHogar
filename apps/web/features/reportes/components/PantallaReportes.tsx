'use client';

import { BarChart3 } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRef } from 'react';
import { esErrorApi } from '@/shared/api/errores';
import { mensajeDe } from '@/shared/lib/errores-usuario';
import { formatearFecha } from '@/shared/lib/fechas';
import { AvisoFundacionNoAprobada } from '@/shared/ui/AvisoFundacionNoAprobada';
import { Boton } from '@/shared/ui/Boton';
import { EstadoError } from '@/shared/ui/EstadoError';
import { EstadoVacio } from '@/shared/ui/EstadoVacio';
import { GuardaFundacionAprobada } from '@/shared/ui/GuardaFundacionAprobada';
import { Pestanas } from '@/shared/ui/Pestanas';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useEstadisticas, useFundacionesAprobadas } from '../hooks/useReportes';
import { aConsultaEstadisticas, consultaAUrl, leerConsulta } from '../lib/consulta';
import {
  ETIQUETA_REPORTE,
  TIPOS_REPORTE,
  type Ambito,
  type ConsultaReportes,
  type TipoReporte,
} from '../types';
import { FiltroReportes } from './FiltroReportes';
import { PanelReporte } from './PanelReporte';
import { SelectorFundacion } from './SelectorFundacion';
import { TotalesReporte } from './TotalesReporte';

function textoDelRango(c: ConsultaReportes): string {
  if (c.desde && c.hasta) return `del ${formatearFecha(c.desde)} al ${formatearFecha(c.hasta)}`;
  if (c.desde) return `desde el ${formatearFecha(c.desde)}`;
  if (c.hasta) return `hasta el ${formatearFecha(c.hasta)}`;
  return 'de todo el periodo';
}

function Contenido({ ambito }: { ambito: Ambito }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const consulta = leerConsulta(params);
  const estadisticas = useEstadisticas(ambito, aConsultaEstadisticas(consulta, ambito));
  const fundaciones = useFundacionesAprobadas(ambito === 'administrador');
  const titulo = useRef<HTMLHeadingElement>(null);

  // El encabezado del resultado sigue montado mientras llegan los datos nuevos (se conservan los
  // anteriores), así que el foco puede moverse en cuanto se aplica el filtro.
  function ir(siguiente: ConsultaReportes, moverFoco = true) {
    router.push(`${pathname}${consultaAUrl(siguiente)}`);
    if (moverFoco) window.setTimeout(() => titulo.current?.focus(), 0);
  }

  const error = estadisticas.isError ? estadisticas.error : null;
  if (ambito === 'fundacion' && esErrorApi(error) && error.estado === 403) {
    return <AvisoFundacionNoAprobada mensajeServidor={mensajeDe(error)} />;
  }

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">Reportes</h1>
        <p className="text-muted-foreground">
          Elige el tipo de reporte y las fechas. Cada gráfica trae su tabla con los mismos datos.
        </p>
      </div>

      {ambito === 'administrador' && (
        <p role="note" className="border-info bg-info text-info-foreground rounded-md border p-3">
          Los reportes de toda la plataforma se consultan en gráficas y tablas. Los PDF los genera
          cada fundación desde su propio panel.
        </p>
      )}

      {ambito === 'administrador' && (
        <SelectorFundacion
          fundacion={consulta.fundacion}
          alCambiar={(fundacion) => ir({ ...consulta, fundacion })}
        />
      )}

      <FiltroReportes
        key={consultaAUrl({ ...consulta, reporte: 'adopciones' })}
        consulta={consulta}
        alAplicar={ir}
      />

      <div
        aria-live="polite"
        aria-busy={estadisticas.isFetching || undefined}
        className="flex flex-col gap-6"
      >
        {estadisticas.isPending ? (
          <Skeleton className="h-64" etiqueta="Cargando los reportes" />
        ) : error ? (
          esErrorApi(error) && error.estado === 404 ? (
            <EstadoVacio
              icono={BarChart3}
              titulo="La fundación indicada no existe"
              descripcion={mensajeDe(error)}
              accion={
                <Boton
                  variante="contorno"
                  onClick={() => ir({ ...consulta, fundacion: undefined })}
                >
                  Ver toda la plataforma
                </Boton>
              }
            />
          ) : (
            <EstadoError
              error={error}
              titulo="No pudimos cargar los reportes"
              alReintentar={() => void estadisticas.refetch()}
              reintentando={estadisticas.isFetching}
            />
          )
        ) : estadisticas.data ? (
          <>
            <h2 ref={titulo} tabIndex={-1} className="text-2xl focus:outline-2">
              Resultados {textoDelRango(consulta)}
              {ambito === 'administrador' &&
                ` · ${
                  consulta.fundacion
                    ? (fundaciones.data?.fundaciones.find((f) => f.id === consulta.fundacion)
                        ?.nombre ?? `Fundación #${consulta.fundacion}`)
                    : 'Toda la plataforma'
                }`}
            </h2>
            <TotalesReporte datos={estadisticas.data} />
            <Pestanas
              etiqueta="Tipo de reporte"
              valor={consulta.reporte}
              onCambio={(v) => ir({ ...consulta, reporte: v as TipoReporte }, false)}
              pestanas={TIPOS_REPORTE.map((r) => ({
                valor: r,
                etiqueta: ETIQUETA_REPORTE[r],
                contenido: (
                  <PanelReporte
                    reporte={r}
                    datos={estadisticas.data}
                    ambito={ambito}
                    consulta={consulta}
                  />
                ),
              }))}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Reportes y gráficas; el ámbito decide la fuente de datos, la guarda y la presencia de PDF. */
export function PantallaReportes({ ambito }: { ambito: Ambito }) {
  if (ambito === 'fundacion') {
    return (
      <GuardaFundacionAprobada>
        <Contenido ambito={ambito} />
      </GuardaFundacionAprobada>
    );
  }
  return <Contenido ambito={ambito} />;
}
