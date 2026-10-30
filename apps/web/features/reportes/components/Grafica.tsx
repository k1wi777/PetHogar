'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/shared/ui/Skeleton';
import type { Serie } from '../lib/series';

/**
 * Recharts solo se carga en el navegador y solo al montar una gráfica (`ssr: false`): ninguna
 * página pública incluye el chunk. Este archivo NO importa Recharts; lo hacen las dos vistas.
 */
const Cargando = () => <Skeleton className="h-64" etiqueta="Cargando la gráfica" />;
const VistaBarras = dynamic(() => import('./VistaBarras'), { ssr: false, loading: Cargando });
const VistaDona = dynamic(() => import('./VistaDona'), { ssr: false, loading: Cargando });

export function Grafica({ serie }: { serie: Serie }) {
  return serie.tipo === 'dona' ? <VistaDona serie={serie} /> : <VistaBarras serie={serie} />;
}
