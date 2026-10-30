'use client';

import { Campo } from '@/shared/ui/Campo';
import { Selector } from '@/shared/ui/Selector';
import { MAX_FUNDACIONES_SELECTOR } from '../api/fundaciones';
import { useFundacionesAprobadas } from '../hooks/useReportes';

const TODAS = 'todas';

/**
 * Selector de fundación del administrador («Todas» + aprobadas). La lista del backend está
 * acotada a 100: una fundación de la URL que no esté en ella se conserva como opción.
 */
export function SelectorFundacion({
  fundacion,
  alCambiar,
}: {
  fundacion: number | undefined;
  alCambiar: (fundacion: number | undefined) => void;
}) {
  const lista = useFundacionesAprobadas(true);
  const fundaciones = lista.data?.fundaciones ?? [];
  const opciones = [
    { valor: TODAS, texto: 'Todas las fundaciones' },
    ...fundaciones.map((f) => ({ valor: String(f.id), texto: f.nombre })),
  ];
  if (fundacion && !fundaciones.some((f) => f.id === fundacion)) {
    opciones.push({ valor: String(fundacion), texto: `Fundación #${fundacion}` });
  }
  return (
    <div className="sm:max-w-sm">
      <Campo
        etiqueta="Fundación"
        ayuda={
          lista.isError
            ? 'No pudimos cargar las fundaciones; puedes seguir viendo toda la plataforma.'
            : lista.data?.hayMas
              ? `Mostramos las primeras ${MAX_FUNDACIONES_SELECTOR} fundaciones aprobadas.`
              : undefined
        }
      >
        <Selector
          opciones={opciones}
          valor={fundacion ? String(fundacion) : TODAS}
          onCambio={(v) => alCambiar(v === TODAS ? undefined : Number(v))}
        />
      </Campo>
    </div>
  );
}
