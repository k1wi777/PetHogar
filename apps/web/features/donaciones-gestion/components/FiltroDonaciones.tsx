'use client';

import { useState } from 'react';
import { hoyEnBogota } from '@/shared/lib/fechas';
import { Boton } from '@/shared/ui/Boton';
import { Campo, Entrada } from '@/shared/ui/Campo';
import { Selector } from '@/shared/ui/Selector';
import { PERIODO_TODO, periodoEsteMes, periodoMesAnterior, type Periodo } from '../lib/consulta';
import { esquemaPeriodo } from '../schemas/periodo';
import {
  ETIQUETA_TIPO,
  TIPOS_DONACION,
  type ConsultaDonaciones,
  type TipoDonacion,
} from '../types';

const TODOS = 'todos';
const OPCIONES_TIPO = [
  { valor: TODOS, texto: 'Todos los tipos' },
  ...TIPOS_DONACION.map((t) => ({ valor: t, texto: ETIQUETA_TIPO[t] })),
];

/**
 * Filtro de periodo y tipo. Valida antes de cambiar la URL: un periodo incoherente se avisa junto
 * al campo y no lanza ninguna consulta. Se vuelve a montar (por `key`) cuando cambia la URL.
 */
export function FiltroDonaciones({
  consulta,
  alAplicar,
}: {
  consulta: ConsultaDonaciones;
  alAplicar: (siguiente: ConsultaDonaciones) => void;
}) {
  const [desde, setDesde] = useState(consulta.desde ?? '');
  const [hasta, setHasta] = useState(consulta.hasta ?? '');
  const [tipo, setTipo] = useState<TipoDonacion | undefined>(consulta.tipo);
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
    alAplicar({
      pagina: 1,
      desde: r.data.desde || undefined,
      hasta: r.data.hasta || undefined,
      tipo,
    });
  }

  function atajo(periodo: Periodo) {
    alAplicar({ pagina: 1, ...periodo, tipo });
  }

  return (
    <form
      noValidate
      onSubmit={aplicar}
      aria-label="Filtrar donaciones"
      className="border-border-suave bg-card flex flex-col gap-4 rounded-lg border p-4"
    >
      <div className="grid gap-4 sm:grid-cols-3">
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
        <Campo etiqueta="Tipo de aporte">
          <Selector
            opciones={OPCIONES_TIPO}
            valor={tipo ?? TODOS}
            onCambio={(v) => setTipo(v === TODOS ? undefined : (v as TipoDonacion))}
          />
        </Campo>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Boton type="submit" className="w-full sm:w-auto">
          Aplicar filtros
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
