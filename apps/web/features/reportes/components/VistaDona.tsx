'use client';

import { useId } from 'react';
import { Pie, PieChart, ResponsiveContainer } from 'recharts';
import { COLOR_FONDO_GRAFICA, SEPARACION_REBANADAS_PX } from '@/shared/lib/grafica';
import { TOKENS_COLOR } from '@/shared/lib/tokens';
import type { Serie } from '../lib/series';
import { PatronesGrafica, rellenoDe } from './PatronesGrafica';

const RADIANES = Math.PI / 180;
const RADIO_EXTERIOR = 64;

interface PropsEtiqueta {
  cx: number;
  cy: number;
  midAngle: number;
  outerRadius: number;
  payload: { nombre: string; valorTexto: string; porcentaje?: number };
}

/** Etiqueta externa «Nombre / valor (porcentaje)»: el dato nunca depende del color ni de un tooltip. */
function EtiquetaRebanada({ cx, cy, midAngle, outerRadius, payload }: PropsEtiqueta) {
  const x = cx + (outerRadius + 12) * Math.cos(-midAngle * RADIANES);
  const y = cy + (outerRadius + 12) * Math.sin(-midAngle * RADIANES);
  const anchor = x > cx ? 'start' : 'end';
  return (
    <text x={x} y={y} textAnchor={anchor} fill={TOKENS_COLOR.foreground} fontSize={12}>
      <tspan x={x} dy="-0.2em" fontWeight={600}>
        {payload.nombre}
      </tspan>
      <tspan x={x} dy="1.2em">
        {payload.valorTexto} ({payload.porcentaje} %)
      </tspan>
    </text>
  );
}

/**
 * Dona para composiciones de 2 a 5 categorías sobre un total. Las categorías en 0 no dibujan
 * rebanada (siguen en la tabla); el centro muestra el total. Uno de los dos únicos archivos que
 * importan Recharts; se carga solo en el navegador.
 */
export default function VistaDona({ serie }: { serie: Serie }) {
  const prefijo = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const datos = serie.filas
    .map((f, i) => ({
      nombre: f.etiqueta,
      valor: f.valor,
      valorTexto: f.valorTexto,
      porcentaje: f.porcentaje,
      fill: rellenoDe(prefijo, i),
    }))
    .filter((d) => d.valor > 0);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart accessibilityLayer={false} style={{ overflow: 'visible' }}>
          <PatronesGrafica prefijo={prefijo} />
          <Pie
            data={datos}
            dataKey="valor"
            nameKey="nombre"
            innerRadius={38}
            outerRadius={RADIO_EXTERIOR}
            startAngle={90}
            endAngle={-270}
            stroke={COLOR_FONDO_GRAFICA}
            strokeWidth={SEPARACION_REBANADAS_PX}
            isAnimationActive={false}
            label={(p: unknown) => <EtiquetaRebanada {...(p as PropsEtiqueta)} />}
            labelLine={{ stroke: TOKENS_COLOR.border }}
          ></Pie>
        </PieChart>
      </ResponsiveContainer>
      {/* El centro es HTML (el total en texto) para no depender de la geometría interna de Recharts. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
      >
        <span className="text-xl leading-none font-bold">{serie.total}</span>
        <span className="text-xs">en total</span>
      </div>
    </div>
  );
}
