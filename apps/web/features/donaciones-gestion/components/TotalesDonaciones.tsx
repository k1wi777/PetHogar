import { formatearMonto } from '@/shared/lib/monto';
import type { TotalesDonaciones as Totales } from '../types';

const aportes = (n: number) => `${n} ${n === 1 ? 'aporte' : 'aportes'}`;

/**
 * Totales tal como los entrega el backend para el periodo y tipo filtrados. El monto es una
 * cadena y solo se formatea para mostrar: nunca pasa por `Number`.
 */
export function TotalesDonaciones({ totales }: { totales: Totales }) {
  return (
    <section aria-labelledby="titulo-totales" className="flex flex-col gap-2">
      <h2 id="titulo-totales" className="text-2xl">
        Totales del periodo
      </h2>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="border-border-suave bg-card flex flex-col gap-1 rounded-lg border p-4">
          <dt className="font-semibold">Económicas</dt>
          <dd className="text-2xl font-bold break-words">
            {formatearMonto(totales.economica.monto)}
          </dd>
          <dd className="text-muted-foreground text-sm">{aportes(totales.economica.cantidad)}</dd>
        </div>
        <div className="border-border-suave bg-card flex flex-col gap-1 rounded-lg border p-4">
          <dt className="font-semibold">En especie</dt>
          <dd className="text-2xl font-bold">{aportes(totales.especie.cantidad)}</dd>
        </div>
      </dl>
    </section>
  );
}
