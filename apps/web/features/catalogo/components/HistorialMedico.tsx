import { etiquetaTipoHistorial } from '@/shared/lib/formato-mascota';
import { fechaLarga } from '../lib/formato';
import type { EventoMedico } from '../types';

export function HistorialMedico({ eventos }: { eventos: EventoMedico[] }) {
  return (
    <section aria-labelledby="historial-titulo">
      <h2 id="historial-titulo" className="text-2xl">
        Historial médico
      </h2>
      {eventos.length === 0 ? (
        <p className="text-muted-foreground mt-3">Todavía no hay registros médicos.</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-3">
          {eventos.map((e) => (
            <li key={e.id} className="bg-card border-border-suave rounded-lg border p-4">
              <p className="font-semibold">
                {etiquetaTipoHistorial(e.tipo)} ·{' '}
                <time dateTime={e.fecha}>{fechaLarga(e.fecha)}</time>
              </p>
              <p>{e.descripcion}</p>
              {e.veterinario && (
                <p className="text-muted-foreground text-sm">Atendido por {e.veterinario}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
