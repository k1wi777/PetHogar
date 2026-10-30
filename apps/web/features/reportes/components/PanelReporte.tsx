import { seriesDe } from '../lib/series';
import {
  ETIQUETA_REPORTE,
  TIPOS_CON_PDF,
  type Ambito,
  type ConsultaReportes,
  type EstadisticasDto,
  type TipoReporte,
} from '../types';
import { BloqueSerie } from './BloqueSerie';
import { BotonDescargaPdf } from './BotonDescargaPdf';

/**
 * Las series de un tipo de reporte. Solo la fundación ofrece PDF (el backend no entrega ninguno al
 * administrador) y solo de los tipos que lo tienen (no hay PDF de adopciones).
 */
export function PanelReporte({
  reporte,
  datos,
  ambito,
  consulta,
}: {
  reporte: TipoReporte;
  datos: EstadisticasDto;
  ambito: Ambito;
  consulta: ConsultaReportes;
}) {
  const conPdf = ambito === 'fundacion' && TIPOS_CON_PDF.includes(reporte);
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="text-2xl">Reporte de {ETIQUETA_REPORTE[reporte].toLowerCase()}</h2>
        {conPdf && <BotonDescargaPdf reporte={reporte} consulta={consulta} />}
      </div>
      {seriesDe(reporte, datos).map((serie) => (
        <BloqueSerie key={serie.id} serie={serie} />
      ))}
    </div>
  );
}
