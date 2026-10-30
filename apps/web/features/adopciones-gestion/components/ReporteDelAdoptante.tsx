import { Info } from 'lucide-react';
import { formatearFechaBogota } from '@/shared/lib/fechas';
import { ImagenPrivada } from '@/shared/ui/ImagenPrivada';
import type { ReporteAdoptante } from '../types';

/** Reporte enviado por el adoptante: comentarios, fecha de envío y fotos autenticadas. */
export function ReporteDelAdoptante({ reporte }: { reporte: ReporteAdoptante }) {
  return (
    <section aria-labelledby="titulo-reporte" className="flex flex-col gap-3">
      <h2 id="titulo-reporte" className="text-2xl">
        Reporte del adoptante
      </h2>
      <div className="border-border-suave bg-card flex flex-col gap-3 rounded-lg border p-4">
        <p className="text-muted-foreground text-sm">
          Enviado el {formatearFechaBogota(reporte.enviadoEn)}
        </p>
        <p className="break-words whitespace-pre-line">{reporte.comentarios}</p>
        {reporte.fotos.length === 0 ? (
          <p className="text-muted-foreground">El adoptante no envió fotos.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2" aria-label="Fotos del reporte del adoptante">
            {reporte.fotos.map((f, i) => (
              <li key={f.id} className="min-w-0">
                <ImagenPrivada url={f.url} alt={`Foto ${i + 1} del reporte del adoptante`} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function EsperandoReporte() {
  return (
    <p className="border-border-suave bg-card flex items-start gap-2 rounded-lg border p-4">
      <Info className="text-info-foreground mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <span>
        El adoptante aún no ha enviado su reporte; podrás registrar el resultado cuando lo envíe.
      </span>
    </p>
  );
}
