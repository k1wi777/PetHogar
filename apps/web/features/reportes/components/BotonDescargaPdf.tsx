'use client';

import { BotonDescarga } from '@/shared/ui/BotonDescarga';
import type { ConsultaReportes, TipoReporte } from '../types';

/** `reporte-solicitudes-2026-10-01_2026-10-31`; sin rango, `reporte-solicitudes`. */
export function nombreDelPdf(reporte: TipoReporte, consulta: ConsultaReportes): string {
  if (!consulta.desde && !consulta.hasta) return `reporte-${reporte}`;
  return `reporte-${reporte}-${consulta.desde ?? 'inicio'}_${consulta.hasta ?? 'hoy'}`;
}

/**
 * PDF real del backend para la fundación (`/fundacion/reportes/<tipo>.pdf`). Descarga el rango
 * APLICADO en pantalla, no el borrador del formulario; los parámetros viajan como consulta, nunca
 * pegados a la ruta.
 */
export function BotonDescargaPdf({
  reporte,
  consulta,
}: {
  reporte: TipoReporte;
  consulta: ConsultaReportes;
}) {
  return (
    <BotonDescarga
      url={`/api/fundacion/reportes/${reporte}.pdf`}
      nombreBase={nombreDelPdf(reporte, consulta)}
      etiqueta={`Descargar PDF de ${reporte}`}
      consulta={{ desde: consulta.desde, hasta: consulta.hasta }}
    />
  );
}
