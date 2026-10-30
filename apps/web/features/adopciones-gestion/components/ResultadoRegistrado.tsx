'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { formatearFecha } from '@/shared/lib/fechas';
import { ImagenPrivada } from '@/shared/ui/ImagenPrivada';
import { ETIQUETA_BIENESTAR, type DetalleSeguimientoFundacion } from '../types';

/** Alerta con icono y texto (no solo color) cuando el bienestar es «malo». */
export function AlertaBienestarMalo() {
  return (
    <div
      role="alert"
      className="border-destructive bg-card flex items-start gap-3 rounded-lg border-2 border-l-8 p-4"
    >
      <AlertTriangle className="text-destructive mt-0.5 size-6 shrink-0" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="text-lg font-bold">Estado de bienestar malo</p>
        <p>
          Se avisó al equipo de la fundación y a la administración de PetHogar para que den
          seguimiento.
        </p>
      </div>
    </div>
  );
}

/** Resultado ya registrado; justo después de guardarlo recibe el foco porque el formulario desaparece. */
export function ResultadoRegistrado({
  s,
  enfocar,
}: {
  s: DetalleSeguimientoFundacion;
  enfocar: boolean;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (enfocar) ref.current?.focus();
  }, [enfocar]);
  return (
    <section aria-labelledby="titulo-resultado-registrado" className="flex flex-col gap-4">
      <div
        role={enfocar ? 'status' : undefined}
        className="border-success bg-card flex items-center gap-2 rounded-lg border-2 p-4"
      >
        <CheckCircle2 className="text-success size-6 shrink-0" aria-hidden="true" />
        <h2
          id="titulo-resultado-registrado"
          ref={ref}
          tabIndex={-1}
          className="text-2xl focus:outline-2"
        >
          Resultado registrado
        </h2>
      </div>
      {s.estadoBienestar === 'malo' && <AlertaBienestarMalo />}
      <dl className="border-border-suave bg-card grid gap-x-4 gap-y-3 rounded-lg border p-4 sm:grid-cols-[10rem_1fr]">
        {s.fechaRealizada && (
          <>
            <dt className="font-semibold">Realizado el</dt>
            <dd>{formatearFecha(s.fechaRealizada)}</dd>
          </>
        )}
        {s.estadoBienestar && (
          <>
            <dt className="font-semibold">Bienestar</dt>
            <dd>{ETIQUETA_BIENESTAR[s.estadoBienestar]}</dd>
          </>
        )}
        <dt className="font-semibold">Observaciones</dt>
        <dd className="min-w-0 break-words whitespace-pre-line">{s.observaciones}</dd>
      </dl>
      {s.evidencias.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-bold">Evidencias</h3>
          <ul className="grid gap-3 sm:grid-cols-2" aria-label="Evidencias del seguimiento">
            {s.evidencias.map((f, i) => (
              <li key={f.id} className="min-w-0">
                <ImagenPrivada url={f.url} alt={`Evidencia ${i + 1} del seguimiento`} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
