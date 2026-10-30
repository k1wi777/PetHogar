'use client';

import { useState } from 'react';
import { hoyEnBogota } from '@/shared/lib/fechas';
import { Boton } from '@/shared/ui/Boton';
import { Campo, Entrada } from '@/shared/ui/Campo';
import { PERIODO_TODO, periodoEsteMes, periodoMesAnterior, type Periodo } from '../lib/consulta';
import { esquemaPeriodo } from '../schemas/periodo';
import type { ConsultaReportes } from '../types';

/**
 * Rango de fechas (calendario de Bogotá) y atajos. Valida antes de cambiar la URL: un rango
 * incoherente se avisa junto al campo y no lanza ninguna consulta. Se vuelve a montar (por `key`)
 * cuando cambia la URL. El tipo de reporte y la fundación se conservan.
 */
export function FiltroReportes({
  consulta,
  alAplicar,
}: {
  consulta: ConsultaReportes;
  alAplicar: (siguiente: ConsultaReportes) => void;
}) {
  const [desde, setDesde] = useState(consulta.desde ?? '');
  const [hasta, setHasta] = useState(consulta.hasta ?? '');
  const [errores, setErrores] = useState<{ desde?: string; hasta?: string }>({});

  function aplicar(e: React.FormEvent) {
    e.preventDefault();
    const r = esquemaPeriodo.safeParse({ desde, hasta });
    if (!r.success) {
      const siguiente: { desde?: string; hasta?: string } = {};
      for (const i of r.error.issues) {
        const campo = i.path[0] as 'desde' | 'hasta';
        siguiente[campo] ??= i.message;
      }
      setErrores(siguiente);
      return;
    }
    setErrores({});
    alAplicar({ ...consulta, desde: r.data.desde || undefined, hasta: r.data.hasta || undefined });
  }

  function atajo(periodo: Periodo) {
    alAplicar({ ...consulta, ...periodo });
  }

  return (
    <form
      noValidate
      onSubmit={aplicar}
      aria-label="Filtrar el reporte por fechas"
      className="border-border-suave bg-card flex flex-col gap-4 rounded-lg border p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Desde" error={errores.desde}>
          <Entrada
            type="date"
            value={desde}
            max={hoyEnBogota()}
            onChange={(e) => setDesde(e.target.value)}
          />
        </Campo>
        <Campo etiqueta="Hasta" error={errores.hasta}>
          <Entrada type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </Campo>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Boton type="submit" className="w-full sm:w-auto">
          Aplicar fechas
        </Boton>
        <Boton
          variante="contorno"
          onClick={() => atajo(periodoEsteMes())}
          className="w-full sm:w-auto"
        >
          Este mes
        </Boton>
        <Boton
          variante="contorno"
          onClick={() => atajo(periodoMesAnterior())}
          className="w-full sm:w-auto"
        >
          Mes anterior
        </Boton>
        <Boton variante="contorno" onClick={() => atajo(PERIODO_TODO)} className="w-full sm:w-auto">
          Todo
        </Boton>
      </div>
    </form>
  );
}
