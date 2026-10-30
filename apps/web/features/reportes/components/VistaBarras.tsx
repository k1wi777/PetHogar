'use client';

import { useId } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { COLOR_FONDO_GRAFICA } from '@/shared/lib/grafica';
import { TOKENS_COLOR } from '@/shared/lib/tokens';
import type { Serie } from '../lib/series';
import { PatronesGrafica, rellenoDe } from './PatronesGrafica';

const TEXTO = { fill: TOKENS_COLOR.foreground, fontSize: 12 } as const;

/** Alto por tipo: las barras horizontales crecen con el número de categorías. */
function altoDe(serie: Serie): number {
  return serie.tipo === 'barras' ? Math.max(160, serie.filas.length * 44 + 24) : 260;
}

/**
 * Columnas (series temporales) o barras horizontales (categorías abiertas). Es uno de los dos
 * únicos archivos que importan Recharts; se carga solo en el navegador (ver `Grafica`). Cada barra
 * lleva patrón y rótulo con su valor; el eje de valores se oculta porque cada barra ya lo rotula.
 */
export default function VistaBarras({ serie }: { serie: Serie }) {
  const prefijo = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const horizontal = serie.tipo === 'barras';
  return (
    <ResponsiveContainer width="100%" height={altoDe(serie)}>
      <BarChart
        data={serie.filas}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={
          horizontal
            ? { top: 4, right: 64, bottom: 4, left: 0 }
            : { top: 36, right: 8, bottom: 4, left: 8 }
        }
        accessibilityLayer={false}
        style={{ overflow: 'visible' }}
      >
        <PatronesGrafica prefijo={prefijo} />
        <CartesianGrid
          stroke={TOKENS_COLOR['border-suave']}
          vertical={horizontal}
          horizontal={!horizontal}
        />
        {horizontal ? (
          <>
            <XAxis type="number" hide domain={[0, 'dataMax']} />
            <YAxis
              type="category"
              dataKey="etiquetaCorta"
              width={96}
              tick={TEXTO}
              axisLine={{ stroke: TOKENS_COLOR.border }}
              tickLine={false}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey="etiquetaCorta"
              tick={TEXTO}
              interval="preserveStartEnd"
              axisLine={{ stroke: TOKENS_COLOR.border }}
              tickLine={false}
            />
            <YAxis hide domain={[0, 'dataMax']} />
          </>
        )}
        <Bar
          dataKey="valor"
          fill={rellenoDe(prefijo, 0)}
          stroke={COLOR_FONDO_GRAFICA}
          isAnimationActive={false}
          maxBarSize={56}
        >
          <LabelList
            dataKey="valorTexto"
            // Espacio duro: Recharts parte el rótulo en el espacio de «$ 300.001».
            formatter={(v: unknown) => String(v).replace(/ /g, '\u00a0')}
            position={horizontal ? 'right' : 'top'}
            style={{ ...TEXTO, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
