import { formatearMonto } from '@/shared/lib/monto';
import type { EstadisticasDto } from '../types';

const n = (cantidad: number, uno: string, varios: string) =>
  `${cantidad} ${cantidad === 1 ? uno : varios}`;

/**
 * Totales tal como los entrega el servidor para el rango y el ámbito. El monto es una cadena y
 * solo se formatea para mostrar: nunca se suma con `Number`.
 */
export function TotalesReporte({ datos }: { datos: EstadisticasDto }) {
  const tarjetas = [
    { titulo: 'Adopciones', valor: n(datos.adopciones.total, 'adopción', 'adopciones') },
    { titulo: 'Solicitudes', valor: n(datos.solicitudes.total, 'solicitud', 'solicitudes') },
    { titulo: 'Seguimientos', valor: n(datos.seguimientos.total, 'seguimiento', 'seguimientos') },
    {
      titulo: 'Donaciones',
      valor: n(datos.donaciones.total, 'aporte', 'aportes'),
      detalle: `Económicas: ${formatearMonto(datos.donaciones.porTipo.economica.monto)}`,
    },
  ];
  return (
    <section aria-labelledby="titulo-totales-reporte" className="flex flex-col gap-2">
      <h2 id="titulo-totales-reporte" className="text-2xl">
        Totales
      </h2>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map((t) => (
          <div
            key={t.titulo}
            className="border-border-suave bg-card flex min-w-0 flex-col gap-1 rounded-lg border p-4"
          >
            <dt className="font-semibold">{t.titulo}</dt>
            <dd className="text-xl font-bold break-words">{t.valor}</dd>
            {t.detalle && (
              <dd className="text-muted-foreground text-sm break-words">{t.detalle}</dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
